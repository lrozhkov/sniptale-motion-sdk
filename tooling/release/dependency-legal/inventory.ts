import type {
  LockRecord,
  LockPackages,
  LegalComponent,
  ProductionComponent,
} from "./model.ts";
import { diagnosticValue } from "../../../src/sdk/diagnostic-value.js";
import path from "node:path";

import { containedPath, readContainedRegularFile } from "./boundary.ts";

function codePointOrder(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object.`);
  return value;
}

function dependencyMap(
  value: unknown,
  label: string,
): Record<string, string> | undefined {
  if (value === undefined) return undefined;
  const record = objectValue(value, label);
  const result: Record<string, string> = {};
  for (const [name, range] of Object.entries(record)) {
    if (name === "" || typeof range !== "string" || range === "")
      throw new TypeError(
        `${label} must map package names to non-empty ranges.`,
      );
    result[name] = range;
  }
  return result;
}
function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || value === "")
    throw new TypeError(`${label} must be a non-empty string.`);
  return value;
}
function validateLockRecord(
  record: Record<string, unknown>,
  label: string,
  isRoot: boolean,
): LockRecord {
  const result: LockRecord = {
    version: requiredText(record.version, `${label}.version`),
    license: requiredText(record.license, `${label}.license`),
  };
  if (isRoot) result.name = requiredText(record.name, `${label}.name`);
  else if (typeof record.name === "string") result.name = record.name;
  for (const field of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ] as const) {
    const dependencies = dependencyMap(record[field], `${label}.${field}`);
    if (dependencies !== undefined) result[field] = dependencies;
  }
  if (record.peerDependenciesMeta !== undefined) {
    const meta = objectValue(
      record.peerDependenciesMeta,
      `${label}.peerDependenciesMeta`,
    );
    const checked: Record<string, { optional?: boolean }> = {};
    for (const [name, rawEntry] of Object.entries(meta)) {
      const entry = objectValue(
        rawEntry,
        `${label}.peerDependenciesMeta.${name}`,
      );
      for (const key of Object.keys(entry))
        if (key !== "optional")
          throw new TypeError(
            `${label}.peerDependenciesMeta.${name} has an unsupported field.`,
          );
      const optional = entry.optional;
      if (optional !== undefined && typeof optional !== "boolean")
        throw new TypeError(
          `${label}.peerDependenciesMeta.${name}.optional must be boolean.`,
        );
      checked[name] = typeof optional === "boolean" ? { optional } : {};
    }
    result.peerDependenciesMeta = checked;
  }
  for (const field of [
    "dev",
    "optional",
    "devOptional",
    "link",
    "inBundle",
  ] as const) {
    const value = record[field];
    if (value !== undefined) {
      if (typeof value !== "boolean")
        throw new TypeError(`${label}.${field} must be boolean.`);
      result[field] = value;
    }
  }
  for (const field of ["resolved", "integrity"] as const) {
    if (!isRoot)
      result[field] = requiredText(record[field], `${label}.${field}`);
    else if (typeof record[field] === "string") result[field] = record[field];
  }
  return result;
}

function packageNameFromPath(packagePath: string): string {
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

function dependencyNames(record: LockRecord): string[] {
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

function resolutionCandidates(
  ownerPath: string,
  dependencyName: string,
): string[] {
  if (ownerPath === "") return [`node_modules/${dependencyName}`];
  const candidates = [`${ownerPath}/node_modules/${dependencyName}`];
  const marker = "node_modules/";
  for (let index = ownerPath.lastIndexOf(marker); index >= 0;) {
    const prefix = ownerPath.slice(0, index).replace(/\/$/u, "");
    candidates.push(
      `${prefix}${prefix === "" ? "" : "/"}node_modules/${dependencyName}`,
    );
    if (index === 0) break;
    index = ownerPath.lastIndexOf(marker, index - 1);
  }
  return [...new Set(candidates)];
}

function resolveDependency(
  packages: LockPackages,
  ownerPath: string,
  dependencyName: string,
): string {
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
  repoRoot: string,
  lockfilePath = "package-lock.json",
) {
  const rootDirectory = path.resolve(repoRoot);
  const absolute = containedPath(
    rootDirectory,
    lockfilePath,
    "package-lock path",
  );
  let document: unknown;
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
      `Unable to parse package-lock: ${error instanceof Error ? error.message : diagnosticValue(error)}`,
    );
  }
  const root = objectValue(document, "package-lock");
  if (root.lockfileVersion !== 3)
    throw new TypeError(
      "Dependency legal review requires package-lock format 3.",
    );
  const rawPackages = objectValue(root.packages, "package-lock.packages");
  const packages: Record<string, LockRecord> = {};
  if (!rawPackages[""])
    throw new TypeError("package-lock.packages is missing its root record.");
  for (const [packagePath, rawRecord] of Object.entries(rawPackages)) {
    if (packagePath !== "")
      containedPath(rootDirectory, packagePath, "package-lock package path");
    const record = objectValue(
      rawRecord,
      `package-lock.packages[${JSON.stringify(packagePath)}]`,
    );
    packages[packagePath] = validateLockRecord(
      record,
      `package-lock.packages[${JSON.stringify(packagePath)}]`,
      packagePath === "",
    );
    if (packagePath !== "") packageNameFromPath(packagePath);
  }
  return { document: root, packages };
}

export function fullInventory(packages: LockPackages): LegalComponent[] {
  return Object.entries(packages)
    .filter(([packagePath]) => packagePath !== "")
    .map(([packagePath, record]): LegalComponent => ({
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

export function productionInventory(
  packages: LockPackages,
): ProductionComponent[] {
  const root = requiredRecord(packages, "");
  const pending = dependencyNames(root).map((name) =>
    resolveDependency(packages, "", name),
  );
  const selected = new Set<string>();
  while (pending.length > 0) {
    const packagePath = pending.shift();
    if (packagePath === undefined) break;
    if (selected.has(packagePath)) continue;
    const record = requiredRecord(packages, packagePath);
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
      const record = requiredRecord(packages, packagePath);
      return {
        packageName: packageNameFromPath(packagePath),
        packagePath,
        version: record.version,
        licenseExpression: record.license,
        resolved: requiredText(record.resolved, `${packagePath}.resolved`),
        integrity: requiredText(record.integrity, `${packagePath}.integrity`),
      };
    })
    .sort((left, right) =>
      codePointOrder(
        `${left.packageName}\0${left.version}\0${left.packagePath}`,
        `${right.packageName}\0${right.version}\0${right.packagePath}`,
      ),
    );
}

function requiredRecord(packages: LockPackages, key: string): LockRecord {
  const record = packages[key];
  if (!record) throw new Error(`Missing lock record: ${key || "root"}.`);
  return record;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
