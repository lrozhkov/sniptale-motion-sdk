import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { expect, it } from "vitest";

import { assembleLegalBundle } from "./materials.mjs";
import {
  BASE_POLICY,
  createLegalFixture,
  writeFixtureFile,
} from "./test-support";

const PINNED_TEXT = "MIT pinned upstream fixture\n";
const PINNED_PATH =
  "tooling/release/dependency-legal/sources/alpha-1.0.0.LICENSE";
const PINNED_COMMIT = "b".repeat(40);

function closurePolicy() {
  return {
    ...BASE_POLICY,
    reviewedDecisions: [
      {
        packageName: "media",
        version: "1.0.0",
        licenseExpression: "MIT AND MPL-2.0",
        requiredScope: "production",
        disposition: "Redistribute exact legal text and the locked source.",
        correspondingSourceUrl:
          "https://registry.example.test/media/-/media-1.0.0.tgz",
      },
    ],
    pinnedSources: [
      {
        packageName: "alpha",
        version: "1.0.0",
        licenseExpression: "MIT",
        sourcePath: PINNED_PATH,
        originUrl: `https://source.example.test/alpha/${PINNED_COMMIT}/LICENSE`,
        sha256: createHash("sha256").update(PINNED_TEXT).digest("hex"),
        packageResolved:
          "https://registry.example.test/alpha/-/alpha-1.0.0.tgz",
        packageIntegrity: `sha512-${Buffer.from("alpha@1.0.0").toString("base64")}`,
      },
    ],
  };
}

async function createClosureFixture() {
  const repoRoot = await createLegalFixture({
    packages: [
      {
        name: "alpha",
        dependencies: { beta: "^1" },
        resolved: "https://registry.example.test/alpha/-/alpha-1.0.0.tgz",
      },
      {
        name: "beta",
        packagePath: "node_modules/alpha/node_modules/beta",
        files: {
          "license.md": "MIT beta fixture\n",
          NOTICE: "Beta upstream notice fixture\n",
        },
      },
      {
        name: "media",
        license: "MIT AND MPL-2.0",
        resolved: "https://registry.example.test/media/-/media-1.0.0.tgz",
        files: { COPYING: "Composite MPL media fixture\n" },
      },
    ],
    rootDependencies: { alpha: "^1", media: "^1" },
    policy: closurePolicy(),
  });
  await writeFixtureFile(repoRoot, PINNED_PATH, PINNED_TEXT);
  return repoRoot;
}

it("uses exact pinned or installed legal files and preserves MPL source", async () => {
  const repoRoot = await createClosureFixture();

  const bundle = await assembleLegalBundle({ repoRoot });

  expect(bundle.entries.map((entry) => entry.packageName)).toEqual([
    "alpha",
    "beta",
    "media",
  ]);
  expect(bundle.entries[0]).toMatchObject({
    licenseSourceKind: "pinned-upstream",
    licenseSource: PINNED_PATH,
    licenseProvenance: {
      originUrl: `https://source.example.test/alpha/${PINNED_COMMIT}/LICENSE`,
    },
  });
  expect(
    bundle.entries.find((entry) => entry.packageName === "media"),
  ).toMatchObject({
    correspondingSourceUrl:
      "https://registry.example.test/media/-/media-1.0.0.tgz",
  });
  expect(
    bundle.entries.find((entry) => entry.packageName === "beta"),
  ).toMatchObject({
    notice: { archivePath: expect.stringMatching(/\.NOTICE\.txt$/u) },
  });
  expect(
    bundle.licenseFiles.find((file) => file.archivePath.includes("alpha-1.0.0"))
      ?.contents,
  ).toEqual(Buffer.from(PINNED_TEXT));
});

it("traverses required peers and their dependencies but excludes optional and dev-only edges", async () => {
  const repoRoot = await createLegalFixture({
    packages: [
      {
        name: "alpha",
        dependencies: { beta: "^1" },
        optionalDependencies: { "optional-child": "^1" },
        files: { LICENSE: "alpha\n" },
      },
      {
        name: "beta",
        packagePath: "node_modules/alpha/node_modules/beta",
        peerDependencies: {
          "peer-runtime": "^1",
          "optional-peer": "^1",
        },
        peerDependenciesMeta: { "optional-peer": { optional: true } },
        files: { LICENSE: "beta\n" },
      },
      {
        name: "peer-runtime",
        dependencies: { "peer-child": "^1" },
        files: { LICENSE: "peer runtime\n" },
      },
      { name: "peer-child", files: { LICENSE: "peer child\n" } },
      {
        name: "optional-peer",
        optional: true,
        files: { LICENSE: "optional peer\n" },
      },
      {
        name: "optional-child",
        optional: true,
        files: { LICENSE: "optional child\n" },
      },
      { name: "dev-tool", dev: true, files: { LICENSE: "dev tool\n" } },
    ],
    rootDependencies: { alpha: "^1" },
    rootDevDependencies: { "dev-tool": "^1" },
  });

  const bundle = await assembleLegalBundle({ repoRoot });

  expect(bundle.entries.map((entry) => entry.packageName)).toEqual([
    "alpha",
    "beta",
    "peer-child",
    "peer-runtime",
  ]);
});

it("resolves a nested dependency from its hoisted sibling location", async () => {
  const repoRoot = await createLegalFixture({
    packages: [
      {
        name: "alpha",
        dependencies: { beta: "^1" },
        files: { LICENSE: "alpha\n" },
      },
      {
        name: "beta",
        packagePath: "node_modules/alpha/node_modules/beta",
        dependencies: { gamma: "^1" },
        files: { LICENSE: "beta\n" },
      },
      {
        name: "gamma",
        packagePath: "node_modules/alpha/node_modules/gamma",
        files: { LICENSE: "gamma\n" },
      },
    ],
    rootDependencies: { alpha: "^1" },
  });

  const bundle = await assembleLegalBundle({ repoRoot });

  expect(bundle.entries.map((entry) => entry.packagePath)).toEqual([
    "node_modules/alpha",
    "node_modules/alpha/node_modules/beta",
    "node_modules/alpha/node_modules/gamma",
  ]);
});

it("seeds production from required root peers while excluding optional root edges", async () => {
  const repoRoot = await createLegalFixture({
    packages: [
      {
        name: "alpha",
        files: { LICENSE: "alpha\n" },
      },
      {
        name: "required-root-peer",
        files: { LICENSE: "required root peer\n" },
      },
      {
        name: "optional-root-peer",
        optional: true,
        files: { LICENSE: "optional root peer\n" },
      },
      {
        name: "optional-root-package",
        optional: true,
        files: { LICENSE: "optional root package\n" },
      },
    ],
    rootDependencies: { alpha: "^1" },
    rootOptionalDependencies: { "optional-root-package": "^1" },
    rootPeerDependencies: {
      "required-root-peer": "^1",
      "optional-root-peer": "^1",
    },
    rootPeerDependenciesMeta: {
      "optional-root-peer": { optional: true },
    },
  });

  const bundle = await assembleLegalBundle({ repoRoot });

  expect(bundle.entries.map((entry) => entry.packageName)).toEqual([
    "alpha",
    "required-root-peer",
  ]);
});

it("fails when pinned bytes are missing or changed", async () => {
  const missingRoot = await createClosureFixture();
  await fs.rm(path.join(missingRoot, PINNED_PATH));
  await expect(assembleLegalBundle({ repoRoot: missingRoot })).rejects.toThrow(
    "pinned license text is unavailable",
  );

  const changedRoot = await createClosureFixture();
  await fs.writeFile(path.join(changedRoot, PINNED_PATH), "changed");
  await expect(assembleLegalBundle({ repoRoot: changedRoot })).rejects.toThrow(
    "Pinned license bytes changed",
  );
});

it("never promotes README license metadata into redistributed text", async () => {
  const repoRoot = await createLegalFixture({
    packages: [{ name: "alpha", files: { "README.md": "# License\n\nMIT\n" } }],
    rootDependencies: { alpha: "^1" },
  });

  await expect(assembleLegalBundle({ repoRoot })).rejects.toThrow(
    "No distributable offline license file",
  );
});

it("accepts the LICENCE spelling as exact installed legal text", async () => {
  const repoRoot = await createLegalFixture({
    packages: [
      {
        name: "alpha",
        files: { "LICENCE.md": "MIT licence spelling fixture\n" },
      },
    ],
    rootDependencies: { alpha: "^1" },
  });

  const bundle = await assembleLegalBundle({ repoRoot });

  expect(bundle.entries[0]).toMatchObject({
    licenseSourceKind: "installed-file",
    licenseSource: "node_modules/alpha/LICENCE.md",
  });
  expect(bundle.licenseFiles[0].contents).toEqual(
    Buffer.from("MIT licence spelling fixture\n"),
  );
});
