import type {
  DependencyIdentity,
  RegistryEvidence,
  RegistryMetadata,
  SecurityFixRecord,
} from "./dependency-model.ts";
import {
  readDependencyEvidence,
  readRegistryEvidence,
} from "./dependency-registry.ts";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  advisoryProvesSecurityFix,
  inspectDependencyAdmission,
  MINIMUM_RELEASE_AGE_DAYS,
  NPM_REGISTRY,
  readRegistryPackages,
  readSecurityFixes,
} from "./dependency-admission.ts";

export { MINIMUM_RELEASE_AGE_DAYS, readRegistryPackages };
const DAY = 86_400_000;

export function inspectDependencyAge(
  packages: readonly DependencyIdentity[],
  metadata: RegistryEvidence,
  now = Date.now(),
  fixesInput: unknown = [],
): string[] {
  const findings: string[] = [];
  let fixes: SecurityFixRecord[];
  try {
    fixes = readSecurityFixes(fixesInput, packages, now);
  } catch (error) {
    return [
      error instanceof Error ? error.message : "Invalid security-fix records.",
    ];
  }
  for (const { name, version, integrity, resolved } of packages) {
    const published = metadata[name]?.time?.[version];
    const publishedAt =
      typeof published === "string" ? Date.parse(published) : NaN;
    if (!Number.isFinite(publishedAt) || publishedAt > now) {
      findings.push(
        `${name}@${version}: invalid or missing registry publication time`,
      );
      continue;
    }
    if (
      integrity !== undefined &&
      (metadata[name]?.versions?.[version]?.dist?.integrity !== integrity ||
        metadata[name]?.versions?.[version]?.dist?.tarball !== resolved)
    ) {
      findings.push(
        `${name}@${version}: lock identity differs from registry evidence`,
      );
    }
    const fix = fixes.find(
      (entry) => entry.name === name && entry.version === version,
    );
    if (now - publishedAt >= MINIMUM_RELEASE_AGE_DAYS * DAY) {
      if (fix)
        findings.push(
          `${name}@${version}: remove the obsolete security-fix record`,
        );
      continue;
    }
    if (
      !fix ||
      Date.parse(fix.expiresAt) <= now ||
      Date.parse(fix.expiresAt) > publishedAt + MINIMUM_RELEASE_AGE_DAYS * DAY
    ) {
      findings.push(
        `${name}@${version}: release is younger than seven days; an exact, verified and unexpired vulnerability-fix record is required`,
      );
    }
  }
  return findings;
}

export async function auditDependencyAge(root = process.cwd()) {
  const configurationFindings = inspectDependencyAdmission(root);
  if (configurationFindings.length)
    throw new Error(configurationFindings.join("\n"));
  const lock: unknown = JSON.parse(
    await readFile(resolve(root, "package-lock.json"), "utf8"),
  );
  const packages = readRegistryPackages(lock);
  const fixes = readSecurityFixes(
    JSON.parse(
      await readFile(
        resolve(root, "tooling/configs/qa/security-fixes.json"),
        "utf8",
      ),
    ),
    packages,
    Date.now(),
  );
  const names = [...new Set(packages.map(({ name }) => name))];
  const metadata: Record<string, RegistryMetadata> = {};
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(2, names.length) }, async () => {
      while (next < names.length) {
        const name = names[next++];
        if (name === undefined) break;
        const value = await readDependencyEvidence(
          `${NPM_REGISTRY}${encodeURIComponent(name)}`,
          256 * 1024 * 1024,
        );
        metadata[name] = readRegistryEvidence(value, name, packages);
      }
    }),
  );
  for (const fix of fixes) {
    const id = fix.advisory.split("/").at(-1);
    const advisory = await readDependencyEvidence(
      `https://api.github.com/advisories/${id}`,
      2 * 1024 * 1024,
    );
    if (!advisoryProvesSecurityFix(fix, advisory))
      throw new Error(
        `${fix.name}@${fix.version}: advisory does not establish this exact patched version`,
      );
  }
  const checkedAt = new Date().toISOString();
  const findings = inspectDependencyAge(
    packages,
    metadata,
    Date.parse(checkedAt),
    fixes,
  );
  const directory = resolve(root, ".tmp/security");
  await mkdir(directory, { recursive: true });
  await writeFile(
    resolve(directory, "dependency-age.json"),
    `${JSON.stringify({ checkedAt, minimumDays: MINIMUM_RELEASE_AGE_DAYS, packages, metadata, fixes, findings }, null, 2)}\n`,
    { mode: 0o600 },
  );
  if (findings.length) throw new Error(findings.join("\n"));
  process.stdout.write(
    `Dependency release age and registry closure accepted: ${packages.length} exact versions.\n`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await auditDependencyAge();
}
