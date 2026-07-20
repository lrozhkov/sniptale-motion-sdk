import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

export type PackageFixture = {
  name: string;
  version?: string;
  license?: string;
  packagePath?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  files?: Record<string, string>;
  dev?: boolean;
  optional?: boolean;
  resolved?: string;
  integrity?: string;
};

export const FIXTURE_LICENSE_SOURCE =
  "Copyright <YEAR> <COPYRIGHT HOLDER>\n\nMIT fixture license\n";
export const FIXTURE_LICENSE =
  "MIT License\n\nCopyright (c) 2026 Fixture\n\nMIT fixture license\n";

export const BASE_POLICY = {
  schemaVersion: 1,
  firstPartyLicense: "MIT",
  reportDirectory: ".tmp/licenses",
  projectLicense: {
    path: "LICENSE",
    sourceUrl: "https://opensource.example.test/mit",
    sourcePath: "tooling/release/dependency-legal/sources/osi-mit-template.txt",
    sourceSha256: createHash("sha256")
      .update(FIXTURE_LICENSE_SOURCE)
      .digest("hex"),
    expectedSha256: createHash("sha256").update(FIXTURE_LICENSE).digest("hex"),
    title: "MIT License",
    sourceCopyright: "Copyright <YEAR> <COPYRIGHT HOLDER>",
    copyright: "Copyright (c) 2026 Fixture",
  },
  automaticallyAcceptedLicenses: ["MIT"],
  deniedLicenses: ["GPL-3.0-only"],
  reviewedDecisions: [],
  pinnedSources: [],
};

function packagePathFor(fixture: PackageFixture) {
  return fixture.packagePath ?? `node_modules/${fixture.name}`;
}

export async function createLegalFixture({
  packages = [],
  rootDependencies = {},
  rootDevDependencies = {},
  rootOptionalDependencies = {},
  rootPeerDependencies = {},
  rootPeerDependenciesMeta = {},
  policy = BASE_POLICY,
}: {
  packages?: PackageFixture[];
  rootDependencies?: Record<string, string>;
  rootDevDependencies?: Record<string, string>;
  rootOptionalDependencies?: Record<string, string>;
  rootPeerDependencies?: Record<string, string>;
  rootPeerDependenciesMeta?: Record<string, { optional?: boolean }>;
  policy?: Record<string, unknown>;
} = {}) {
  const repoRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "motion-sdk-legal-"),
  );
  const rootRecord = {
    name: "sniptale-motion-sdk",
    version: "1.0.0",
    license: "MIT",
    dependencies: rootDependencies,
    devDependencies: rootDevDependencies,
    optionalDependencies: rootOptionalDependencies,
    peerDependencies: rootPeerDependencies,
    peerDependenciesMeta: rootPeerDependenciesMeta,
  };
  const lockPackages: Record<string, unknown> = { "": rootRecord };
  for (const fixture of packages) {
    const packagePath = packagePathFor(fixture);
    const version = fixture.version ?? "1.0.0";
    const license = fixture.license ?? "MIT";
    const resolved =
      fixture.resolved ??
      `https://registry.example.test/${fixture.name}/-/${fixture.name.split("/").at(-1)}-${version}.tgz`;
    const integrity =
      fixture.integrity ??
      `sha512-${Buffer.from(`${fixture.name}@${version}`).toString("base64")}`;
    lockPackages[packagePath] = {
      version,
      license,
      resolved,
      integrity,
      ...(fixture.dependencies ? { dependencies: fixture.dependencies } : {}),
      ...(fixture.optionalDependencies
        ? { optionalDependencies: fixture.optionalDependencies }
        : {}),
      ...(fixture.peerDependencies
        ? { peerDependencies: fixture.peerDependencies }
        : {}),
      ...(fixture.peerDependenciesMeta
        ? { peerDependenciesMeta: fixture.peerDependenciesMeta }
        : {}),
      ...(fixture.dev ? { dev: true } : {}),
      ...(fixture.optional ? { optional: true } : {}),
    };
    const installedDirectory = path.join(repoRoot, packagePath);
    await fs.mkdir(installedDirectory, { recursive: true });
    await fs.writeFile(
      path.join(installedDirectory, "package.json"),
      JSON.stringify({
        name: fixture.name,
        version,
        license,
        repository: { url: `https://source.example.test/${fixture.name}` },
      }),
    );
    for (const [fileName, contents] of Object.entries(fixture.files ?? {})) {
      const destination = path.join(installedDirectory, fileName);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, contents);
    }
  }
  await fs.writeFile(
    path.join(repoRoot, "package.json"),
    JSON.stringify({
      name: rootRecord.name,
      version: rootRecord.version,
      license: rootRecord.license,
    }),
  );
  await fs.writeFile(path.join(repoRoot, "LICENSE"), FIXTURE_LICENSE);
  const projectLicense = (policy as typeof BASE_POLICY).projectLicense;
  await writeFixtureFile(
    repoRoot,
    projectLicense.sourcePath,
    FIXTURE_LICENSE_SOURCE,
  );
  await fs.writeFile(
    path.join(repoRoot, "package-lock.json"),
    JSON.stringify({
      name: rootRecord.name,
      version: rootRecord.version,
      lockfileVersion: 3,
      requires: true,
      packages: lockPackages,
    }),
  );
  const policyPath = path.join(repoRoot, "tooling/configs/qa/licenses.json");
  await fs.mkdir(path.dirname(policyPath), { recursive: true });
  await fs.writeFile(policyPath, JSON.stringify(policy));
  return repoRoot;
}

export async function writeFixtureFile(
  repoRoot: string,
  relativePath: string,
  contents: string | Buffer,
) {
  const destination = path.join(repoRoot, relativePath);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, contents);
}
