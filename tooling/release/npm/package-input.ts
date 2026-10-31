import { MOTION_COMPATIBILITY } from "../../../src/shared/compatibility.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function inputRecord(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function inputString(
  record: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = record[field];
  if (typeof value !== "string" || !value) {
    throw new Error(`${label}.${field} must be a nonempty string.`);
  }
  return value;
}

export function parseBuildManifest(value: unknown) {
  const manifest = inputRecord(value, "package.json");
  const dependencies = inputRecord(
    manifest.dependencies,
    "package.json.dependencies",
  );
  const devDependencies = inputRecord(
    manifest.devDependencies,
    "package.json.devDependencies",
  );
  const engines = inputRecord(manifest.engines, "package.json.engines");
  return {
    version: inputString(manifest, "version", "package.json"),
    description: inputString(manifest, "description", "package.json"),
    license: inputString(manifest, "license", "package.json"),
    author: inputString(manifest, "author", "package.json"),
    repository: inputString(manifest, "repository", "package.json"),
    homepage: inputString(manifest, "homepage", "package.json"),
    engines: { node: inputString(engines, "node", "package.json.engines") },
    dependencies: {
      "playwright-core": inputString(
        dependencies,
        "playwright-core",
        "package.json.dependencies",
      ),
      semver: inputString(dependencies, "semver", "package.json.dependencies"),
    },
    devDependencies: {
      skills: inputString(
        devDependencies,
        "skills",
        "package.json.devDependencies",
      ),
    },
  };
}

export function checkBundledDependency(
  value: unknown,
  name: string,
  version: string,
): void {
  const manifest = inputRecord(value, `${name}/package.json`);
  const dependencies =
    manifest.dependencies === undefined
      ? {}
      : inputRecord(manifest.dependencies, `${name}/package.json.dependencies`);
  if (
    manifest.name !== name ||
    manifest.version !== version ||
    Object.keys(dependencies).length
  ) {
    throw new Error(
      `${name} runtime identity or dependency closure differs from the locked package.`,
    );
  }
}

export function parseSkillInstaller(value: unknown, expectedVersion: string) {
  const manifest = inputRecord(value, "skills/package.json");
  const engines = inputRecord(manifest.engines, "skills/package.json.engines");
  const node = inputString(engines, "node", "skills/package.json.engines");
  if (
    manifest.name !== "skills" ||
    manifest.version !== expectedVersion ||
    !/^>=\d+\.\d+\.\d+$/.test(node)
  ) {
    throw new Error(
      "The optional skill installer differs from the pinned development toolchain.",
    );
  }
  return { version: expectedVersion, engines: { node } };
}

export function parseCompiledVersion(value: unknown, expectedVersion: string) {
  const info = inputRecord(value, "Compiled CLI version");
  const compatibility = inputRecord(
    info.compatibility,
    "Compiled CLI compatibility",
  );
  if (
    info.version !== expectedVersion ||
    Object.keys(compatibility).length !==
      Object.keys(MOTION_COMPATIBILITY).length ||
    Object.entries(MOTION_COMPATIBILITY).some(
      ([key, expected]) => compatibility[key] !== expected,
    )
  ) {
    throw new Error(
      "Compiled CLI does not expose the current compatibility contract.",
    );
  }
  return {
    version: expectedVersion,
    compatibility: { ...MOTION_COMPATIBILITY },
  };
}

export function parsePackResult(
  value: unknown,
  expected: { name: string; version: string },
) {
  const entries: unknown[] = Array.isArray(value)
    ? value
    : Object.values(inputRecord(value, "npm pack result"));
  if (entries.length !== 1)
    throw new Error("npm pack must return exactly one package.");
  const entry = inputRecord(entries[0], "npm pack entry");
  if (
    entry.name !== expected.name ||
    entry.version !== expected.version ||
    entry.filename !== `sniptale-motion-${expected.version}.tgz`
  ) {
    throw new Error("npm pack returned a different package identity.");
  }
  if (!Array.isArray(entry.files))
    throw new Error("npm pack files must be an array.");
  const rows: unknown[] = entry.files;
  const files = rows.map((row) => {
    const file = inputRecord(row, "npm pack file");
    const path = inputString(file, "path", "npm pack file");
    if (
      path.includes("\\") ||
      path.split("/").some((part) => !part || part === "." || part === "..")
    ) {
      throw new Error("npm pack file must have a contained relative path.");
    }
    return { path };
  });
  if (new Set(files.map((file) => file.path)).size !== files.length) {
    throw new Error("npm pack returned duplicate file paths.");
  }
  return {
    filename: entry.filename,
    name: expected.name,
    version: expected.version,
    files,
  };
}
