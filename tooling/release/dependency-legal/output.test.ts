import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, it } from "vitest";

import {
  compareLegalBundle,
  publishLegalBundle,
  renderThirdPartyNotices,
} from "./materials.mjs";

const LICENSE_TEXT = Buffer.from("Composite MPL fixture\n");
const ENTRY = {
  packageName: "media",
  version: "1.0.0",
  packagePath: "node_modules/media",
  licenseExpression: "MIT AND MPL-2.0",
  licenseSourceKind: "installed-file",
  licenseSource: "node_modules/media/LICENSE",
  archivePath: "LICENSES/dependencies/media-1.0.0.txt",
  sha256: createHash("sha256").update(LICENSE_TEXT).digest("hex"),
  sourceUrl: "https://source.example.test/media",
  packageResolved: "https://registry.example.test/media/-/media-1.0.0.tgz",
  correspondingSourceUrl:
    "https://registry.example.test/media/-/media-1.0.0.tgz",
};

function bundle() {
  return {
    entries: [ENTRY],
    licenseFiles: [{ archivePath: ENTRY.archivePath, contents: LICENSE_TEXT }],
  };
}

it("publishes an exact set and removes stale dependency artifacts", async () => {
  const outputRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "motion-legal-output-"),
  );
  const stale = path.join(outputRoot, "LICENSES/dependencies/stale.txt");
  await fs.mkdir(path.dirname(stale), { recursive: true });
  await fs.writeFile(stale, "stale");

  await publishLegalBundle({ bundle: bundle(), outputRoot });

  await expect(fs.readFile(stale)).rejects.toMatchObject({ code: "ENOENT" });
  await expect(
    fs.readFile(path.join(outputRoot, ENTRY.archivePath)),
  ).resolves.toEqual(LICENSE_TEXT);
  await expect(
    compareLegalBundle({ bundle: bundle(), outputRoot }),
  ).resolves.toEqual([]);
  expect(renderThirdPartyNotices([ENTRY])).toContain(
    `MPL corresponding source: ${ENTRY.correspondingSourceUrl}`,
  );
});

it("detects byte formatting drift plus missing and extra artifacts", async () => {
  const outputRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "motion-legal-drift-"),
  );
  await publishLegalBundle({ bundle: bundle(), outputRoot });
  await fs.writeFile(
    path.join(outputRoot, ENTRY.archivePath),
    "Composite MPL fixture\r\n",
  );
  await fs.writeFile(
    path.join(outputRoot, "THIRD_PARTY_NOTICES.md"),
    `${renderThirdPartyNotices([ENTRY]).trimEnd()}  \n`,
  );
  await fs.writeFile(
    path.join(outputRoot, "THIRD_PARTY_DEPENDENCIES.json"),
    JSON.stringify({ schemaVersion: 1, entries: [ENTRY] }),
  );
  await fs.writeFile(
    path.join(outputRoot, "LICENSES/dependencies/extra.txt"),
    "extra\n",
  );

  const findings = await compareLegalBundle({ bundle: bundle(), outputRoot });

  expect(findings).toEqual(
    expect.arrayContaining([
      { code: "artifact-inventory-mismatch", target: "LICENSES/dependencies" },
      { code: "artifact-byte-mismatch", target: ENTRY.archivePath },
      {
        code: "generated-document-byte-mismatch",
        target: "THIRD_PARTY_DEPENDENCIES.json",
      },
      {
        code: "generated-document-byte-mismatch",
        target: "THIRD_PARTY_NOTICES.md",
      },
    ]),
  );
});

it("rejects model digest, composite MPL source, and path traversal before writing", async () => {
  const outputRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "motion-legal-reject-"),
  );
  await expect(
    publishLegalBundle({
      bundle: {
        entries: [ENTRY],
        licenseFiles: [
          { archivePath: ENTRY.archivePath, contents: Buffer.from("changed") },
        ],
      },
      outputRoot,
    }),
  ).rejects.toThrow("manifest digest");

  await expect(
    publishLegalBundle({
      bundle: {
        entries: [
          {
            ...ENTRY,
            correspondingSourceUrl: "https://wrong.example.test/source.tgz",
          },
        ],
        licenseFiles: bundle().licenseFiles,
      },
      outputRoot,
    }),
  ).rejects.toThrow("exact locked packageResolved URL");

  await expect(
    publishLegalBundle({
      bundle: {
        entries: [ENTRY],
        licenseFiles: [
          {
            archivePath: "LICENSES/dependencies/../escape.txt",
            contents: LICENSE_TEXT,
          },
        ],
      },
      outputRoot,
    }),
  ).rejects.toThrow("normalized repository-relative path");
});

it("rejects missing MPL URLs and fields outside the exact entry schema", async () => {
  const outputRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "motion-legal-entry-schema-"),
  );
  const {
    packageResolved: _packageResolved,
    correspondingSourceUrl: _correspondingSourceUrl,
    ...missingMplUrls
  } = ENTRY;

  await expect(
    publishLegalBundle({
      bundle: {
        entries: [missingMplUrls],
        licenseFiles: bundle().licenseFiles,
      },
      outputRoot,
    }),
  ).rejects.toThrow("packageResolved is required");

  await expect(
    publishLegalBundle({
      bundle: {
        entries: [{ ...ENTRY, manualReviewNote: "not schema-owned" }],
        licenseFiles: bundle().licenseFiles,
      },
      outputRoot,
    }),
  ).rejects.toThrow("not part of the exact schema");

  await expect(
    publishLegalBundle({
      bundle: {
        entries: [{ ...ENTRY, sourceUrl: "media/repository" }],
        licenseFiles: bundle().licenseFiles,
      },
      outputRoot,
    }),
  ).rejects.toThrow("sourceUrl must be an HTTPS URL");
});

it("does not follow an output symlink during stale artifact cleanup", async () => {
  const outputRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "motion-legal-symlink-root-"),
  );
  const outside = await fs.mkdtemp(
    path.join(os.tmpdir(), "motion-legal-symlink-target-"),
  );
  const sentinel = path.join(outside, "sentinel.txt");
  await fs.writeFile(sentinel, "keep\n");
  await fs.mkdir(path.join(outputRoot, "LICENSES"));
  await fs.symlink(outside, path.join(outputRoot, "LICENSES/dependencies"));

  await expect(
    publishLegalBundle({ bundle: bundle(), outputRoot }),
  ).rejects.toThrow("symbolic link");
  await expect(fs.readFile(sentinel, "utf8")).resolves.toBe("keep\n");
});
