import type {
  RegistryPackage,
  DependencyIdentity,
  SecurityFixRecord,
} from "./dependency-model.ts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PACKAGE = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u;
const VERSION = /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/u;
export const NPM_REGISTRY = "https://registry.npmjs.org/";
export const MINIMUM_RELEASE_AGE_DAYS = 7;

function object(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

export function readRegistryPackages(input: unknown): RegistryPackage[] {
  const lock = object(input, "npm lockfile");
  if (lock.lockfileVersion !== 3)
    throw new Error("Expected a version 3 npm lockfile");
  const packages = new Map<string, RegistryPackage>();
  for (const [path, raw] of Object.entries(
    object(lock.packages, "lockfile packages"),
  )) {
    if (!path) continue;
    if (
      path.includes("\\") ||
      path.split("/").some((part) => !part || part === "." || part === "..")
    ) {
      throw new Error(`${path}: invalid lockfile package path`);
    }
    const entry = object(raw, path);
    const name = entry.name ?? path.split("node_modules/").at(-1);
    if (
      !/^node_modules\/(?:.+\/node_modules\/)?(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/u.test(
        path,
      ) ||
      typeof name !== "string" ||
      !PACKAGE.test(name) ||
      typeof entry.version !== "string" ||
      !VERSION.test(entry.version) ||
      entry.link ||
      entry.inBundle
    ) {
      throw new Error(
        `${path}: dependency must have an exact registry identity`,
      );
    }
    const tarball = `${NPM_REGISTRY}${name}/-/${name.slice(name.lastIndexOf("/") + 1)}-${entry.version}.tgz`;
    if (
      entry.resolved !== tarball ||
      typeof entry.integrity !== "string" ||
      !/^sha512-[A-Za-z0-9+/]{86}==$/u.test(entry.integrity) ||
      Buffer.from(entry.integrity.slice(7), "base64").length !== 64
    ) {
      throw new Error(
        `${path}: dependency must have its exact registry tarball and SHA-512 integrity`,
      );
    }
    const id = `${name}@${entry.version}`;
    const item = {
      name,
      version: entry.version,
      integrity: entry.integrity,
      resolved: tarball,
    };
    const previous = packages.get(id);
    if (previous && previous.integrity !== entry.integrity) {
      throw new Error(`${id}: conflicting integrity records`);
    }
    packages.set(id, item);
  }
  return [...packages.values()];
}

export function inspectDependencyConfiguration(
  input: unknown,
  npmrc: string,
): string[] {
  const manifest = object(input, "package.json");
  const findings: string[] = [];
  const settings = new Map<string, string>();
  for (const line of npmrc.split(/\r?\n/u)) {
    const text = line.trim();
    if (!text || text.startsWith("#") || text.startsWith(";")) continue;
    const match = /^([^=\s]+)=(.*)$/u.exec(text);
    const key = match?.[1];
    const value = match?.[2];
    if (key === undefined || value === undefined || settings.has(key)) {
      findings.push(".npmrc: settings must have unique explicit values");
      continue;
    }
    settings.set(key, value);
  }
  for (const [key, value] of Object.entries({
    registry: NPM_REGISTRY,
    "min-release-age": "7",
    "ignore-scripts": "true",
    "save-exact": "true",
  })) {
    if (settings.get(key) !== value)
      findings.push(`.npmrc: ${key} must equal ${value}`);
  }
  for (const key of settings.keys()) {
    if (/^(?:before|min-release-age-exclude)(?:\[\])?$/u.test(key))
      findings.push(`.npmrc: ${key} bypasses the release-age policy`);
  }
  for (const script of Object.keys(
    object(manifest.scripts ?? {}, "package scripts"),
  )) {
    if (
      /^(?:preinstall|install|postinstall|preprepare|prepare|postprepare)$/iu.test(
        script,
      )
    ) {
      findings.push(
        `package.json: install lifecycle ${script} must not execute automatically`,
      );
    }
  }
  return findings;
}

export function inspectDependencyAdmission(root = process.cwd()) {
  const manifest: unknown = JSON.parse(
    readFileSync(resolve(root, "package.json"), "utf8"),
  );
  const lock: unknown = JSON.parse(
    readFileSync(resolve(root, "package-lock.json"), "utf8"),
  );
  readRegistryPackages(lock);
  verifyManifestLock(manifest, lock);
  return inspectDependencyConfiguration(
    manifest,
    readFileSync(resolve(root, ".npmrc"), "utf8"),
  );
}

export function verifyManifestLock(
  manifestInput: unknown,
  lockInput: unknown,
): void {
  const manifest = object(manifestInput, "package.json");
  const lock = object(lockInput, "npm lockfile");
  const lockPackages = object(lock.packages, "lockfile packages");
  const lockedRoot = object(lockPackages[""], "lockfile root package");
  for (const field of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
  ]) {
    const declared = object(manifest[field] ?? {}, `package.json ${field}`);
    const locked = object(lockedRoot[field] ?? {}, `lockfile ${field}`);
    if (
      Object.keys(declared).length !== Object.keys(locked).length ||
      Object.entries(declared).some(
        ([name, version]) => locked[name] !== version,
      )
    ) {
      throw new Error(`package-lock.json: ${field} differs from package.json`);
    }
    for (const [name, specifier] of Object.entries(declared)) {
      const exact =
        typeof specifier === "string" &&
        /^(?:npm:(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+@)?\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/u.test(
          specifier,
        );
      if (!exact || !lockPackages[`node_modules/${name}`]) {
        throw new Error(
          `${name}: direct dependencies require an exact version and a lock record`,
        );
      }
      const marker = specifier.lastIndexOf("@");
      const target = specifier.startsWith("npm:")
        ? specifier.slice(4, marker)
        : name;
      const version = specifier.startsWith("npm:")
        ? specifier.slice(marker + 1)
        : specifier;
      const entry = object(lockPackages[`node_modules/${name}`], name);
      if (entry.version !== version || (entry.name ?? name) !== target) {
        throw new Error(
          `${name}: direct dependency differs from its locked identity`,
        );
      }
    }
  }
}

export function readSecurityFixes(
  value: unknown,
  packages: readonly Pick<DependencyIdentity, "name" | "version">[],
  now: number,
): SecurityFixRecord[] {
  if (!Array.isArray(value))
    throw new Error("Security-fix records must be an array");
  const identities = new Set<string>();
  const records: unknown[] = value;
  return records.map((raw) => {
    const entry = object(raw, "Security-fix record");
    const fields = ["name", "version", "advisory", "reason", "expiresAt"];
    const { name, version, advisory, reason, expiresAt } = entry;
    if (
      Object.keys(entry).length !== fields.length ||
      typeof name !== "string" ||
      typeof version !== "string" ||
      typeof advisory !== "string" ||
      typeof reason !== "string" ||
      typeof expiresAt !== "string" ||
      !PACKAGE.test(name) ||
      !VERSION.test(version) ||
      !/^https:\/\/github\.com\/advisories\/GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/u.test(
        advisory,
      ) ||
      !reason.trim() ||
      !Number.isFinite(Date.parse(expiresAt)) ||
      Date.parse(expiresAt) <= now
    ) {
      throw new Error(
        "Security-fix records require exact identities, an advisory, a reason and an unexpired deadline",
      );
    }
    const id = `${name}@${version}`;
    if (
      identities.has(id) ||
      !packages.some((item) => item.name === name && item.version === version)
    ) {
      throw new Error(`${id}: duplicate or unused security-fix record`);
    }
    identities.add(id);
    return { name, version, advisory, reason, expiresAt };
  });
}

export function advisoryProvesSecurityFix(
  fix: SecurityFixRecord,
  raw: unknown,
): boolean {
  if (!isRecord(raw)) return false;
  const id = fix.advisory.slice(fix.advisory.lastIndexOf("/") + 1);
  if (
    raw.ghsa_id !== id ||
    raw.withdrawn_at !== null ||
    !Array.isArray(raw.vulnerabilities)
  )
    return false;
  const vulnerabilities: unknown[] = raw.vulnerabilities;
  return vulnerabilities.some(
    (entry) =>
      isRecord(entry) &&
      isRecord(entry.package) &&
      entry.package.ecosystem === "npm" &&
      entry.package.name === fix.name &&
      isRecord(entry.first_patched_version) &&
      entry.first_patched_version.identifier === fix.version,
  );
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
