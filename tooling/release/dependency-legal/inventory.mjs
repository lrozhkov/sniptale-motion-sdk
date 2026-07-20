import path from "node:path";

import { containedPath, readContainedRegularFile } from "./boundary.mjs";

function codePointOrder(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function objectValue(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError(`${label} must be an object.`);
  return value;
}

function dependencyMap(value, label) {
  if (value === undefined) return;
  const record = objectValue(value, label);
  for (const [name, range] of Object.entries(record)) {
    if (name === "" || typeof range !== "string" || range === "")
      throw new TypeError(
        `${label} must map package names to non-empty ranges.`,
      );
  }
}

function validateLockRecord(record, label, isRoot) {
  for (const field of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ])
    dependencyMap(record[field], `${label}.${field}`);
  if (record.peerDependenciesMeta !== undefined) {
    const meta = objectValue(
      record.peerDependenciesMeta,
      `${label}.peerDependenciesMeta`,
    );
    for (const [name, rawEntry] of Object.entries(meta)) {
      const entry = objectValue(
        rawEntry,
        `${label}.peerDependenciesMeta.${name}`,
      );
      for (const key of Object.keys(entry)) {
        if (key !== "optional")
          throw new TypeError(
            `${label}.peerDependenciesMeta.${name} has an unsupported field.`,
          );
      }
      if (entry.optional !== undefined && typeof entry.optional !== "boolean")
        throw new TypeError(
          `${label}.peerDependenciesMeta.${name}.optional must be boolean.`,
        );
    }
  }
  for (const field of ["dev", "optional", "devOptional", "link", "inBundle"]) {
    if (record[field] !== undefined && typeof record[field] !== "boolean")
      throw new TypeError(`${label}.${field} must be boolean.`);
  }
  for (const field of ["name", "version", "license"]) {
    if (
      (isRoot || field !== "name") &&
      (typeof record[field] !== "string" || record[field] === "")
    )
      throw new TypeError(`${label}.${field} must be a non-empty string.`);
  }
  if (!isRoot) {
    for (const field of ["resolved", "integrity"]) {
      if (typeof record[field] !== "string" || record[field] === "")
        throw new TypeError(`${label}.${field} must be a non-empty string.`);
    }
  }
}

function packageNameFromPath(packagePath) {
  if (!packagePath.startsWith("node_modules/"))
    throw new TypeError(`Unsupported package-lock location: ${packagePath}.`);
  const marker = "node_modules/";
  const start = packagePath.lastIndexOf(marker) + marker.length;
  const name = packagePath.slice(start);
  if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u.test(name))
    throw new TypeError(
      `Unable to derive a package identity from ${packagePath}.`,
    );
  return name;
}

function dependencyNames(record) {
  const optional = new Set(Object.keys(record.optionalDependencies ?? {}));
  const direct = Object.keys(record.dependencies ?? {}).filter(
    (name) => !optional.has(name),
  );
  const peers = Object.keys(record.peerDependencies ?? {}).filter(
    (name) =>
      !optional.has(name) &&
      record.peerDependenciesMeta?.[name]?.optional !== true,
  );
  return [...new Set([...direct, ...peers])].sort();
}

function resolutionCandidates(ownerPath, dependencyName) {
  if (ownerPath === "") return [`node_modules/${dependencyName}`];
  const candidates = [`${ownerPath}/node_modules/${dependencyName}`];
  const marker = "node_modules/";
  for (let index = ownerPath.lastIndexOf(marker); index >= 0; ) {
    const prefix = ownerPath.slice(0, index).replace(/\/$/u, "");
    candidates.push(
      `${prefix}${prefix === "" ? "" : "/"}node_modules/${dependencyName}`,
    );
    if (index === 0) break;
    index = ownerPath.lastIndexOf(marker, index - 1);
  }
  return [...new Set(candidates)];
}

function resolveDependency(packages, ownerPath, dependencyName) {
  const resolved = resolutionCandidates(ownerPath, dependencyName).find(
    (candidate) => packages[candidate],
  );
  if (!resolved)
    throw new Error(
      `package-lock cannot resolve ${dependencyName} from ${ownerPath || "the root package"}.`,
    );
  return resolved;
}

export async function openPackageLock(
  repoRoot,
  lockfilePath = "package-lock.json",
) {
  const rootDirectory = path.resolve(repoRoot);
  const absolute = containedPath(
    rootDirectory,
    lockfilePath,
    "package-lock path",
  );
  let document;
  try {
    const relative = path
      .relative(rootDirectory, absolute)
      .split(path.sep)
      .join("/");
    document = JSON.parse(
      (
        await readContainedRegularFile(
          rootDirectory,
          relative,
          "package-lock path",
        )
      ).toString("utf8"),
    );
  } catch (error) {
    throw new Error(
      `Unable to parse package-lock: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const root = objectValue(document, "package-lock");
  if (root.lockfileVersion !== 3)
    throw new TypeError(
      "Dependency legal review requires package-lock format 3.",
    );
  const packages = objectValue(root.packages, "package-lock.packages");
  if (!packages[""])
    throw new TypeError("package-lock.packages is missing its root record.");
  for (const [packagePath, rawRecord] of Object.entries(packages)) {
    if (packagePath !== "")
      containedPath(rootDirectory, packagePath, "package-lock package path");
    const record = objectValue(
      rawRecord,
      `package-lock.packages[${JSON.stringify(packagePath)}]`,
    );
    validateLockRecord(
      record,
      `package-lock.packages[${JSON.stringify(packagePath)}]`,
      packagePath === "",
    );
    if (packagePath !== "") packageNameFromPath(packagePath);
  }
  return { document: root, packages };
}

export function fullInventory(packages) {
  return Object.entries(packages)
    .filter(([packagePath]) => packagePath !== "")
    .map(([packagePath, record]) => ({
      packageName: packageNameFromPath(packagePath),
      packagePath,
      version: record.version,
      licenseExpression: record.license,
      scope: record.dev === true ? "development-only" : "production",
      ...(typeof record.resolved === "string"
        ? { resolved: record.resolved }
        : {}),
      ...(typeof record.integrity === "string"
        ? { integrity: record.integrity }
        : {}),
    }))
    .sort((left, right) => codePointOrder(left.packagePath, right.packagePath));
}

export function productionInventory(packages) {
  const root = packages[""];
  const pending = dependencyNames(root).map((name) =>
    resolveDependency(packages, "", name),
  );
  const selected = new Set();
  while (pending.length > 0) {
    const packagePath = pending.shift();
    if (selected.has(packagePath)) continue;
    const record = packages[packagePath];
    if (record.dev === true)
      throw new Error(
        `Production graph reaches a development-only lock record at ${packagePath}.`,
      );
    selected.add(packagePath);
    for (const dependencyName of dependencyNames(record)) {
      const dependencyPath = resolveDependency(
        packages,
        packagePath,
        dependencyName,
      );
      if (!selected.has(dependencyPath)) pending.push(dependencyPath);
    }
    pending.sort();
  }
  return [...selected]
    .map((packagePath) => {
      const record = packages[packagePath];
      return {
        packageName: packageNameFromPath(packagePath),
        packagePath,
        version: record.version,
        licenseExpression: record.license,
        resolved: record.resolved,
        integrity: record.integrity,
      };
    })
    .sort((left, right) =>
      codePointOrder(
        `${left.packageName}\0${left.version}\0${left.packagePath}`,
        `${right.packageName}\0${right.version}\0${right.packagePath}`,
      ),
    );
}
