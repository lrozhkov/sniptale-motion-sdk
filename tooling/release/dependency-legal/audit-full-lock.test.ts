import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

import { expect, it } from "vitest";

import { auditFullLock, runFullLockAudit } from "./audit-full-lock.ts";
import { BASE_POLICY, createLegalFixture } from "./test-support";

it("inventories lockfile v3 and writes private reports", async () => {
  const policy = {
    ...BASE_POLICY,
    reviewedDecisions: [
      {
        packageName: "argparse",
        version: "2.0.1",
        licenseExpression: "Python-2.0",
        requiredScope: "development-only",
        disposition: "Development-only command parser.",
      },
    ],
  };
  const repoRoot = await createLegalFixture({
    packages: [
      { name: "alpha", files: { LICENSE: "MIT alpha\n" } },
      { name: "argparse", version: "2.0.1", license: "Python-2.0", dev: true },
    ],
    rootDependencies: { alpha: "^1" },
    rootDevDependencies: { argparse: "^2" },
    policy,
  });

  const report = await runFullLockAudit({ repoRoot });

  expect(report).toMatchObject({
    status: "passed",
    packageCount: 2,
    scopeCounts: { production: 1, "development-only": 1 },
  });
  const reportDirectory = path.join(repoRoot, ".tmp/licenses");
  // NTFS mode bits expose owner access, not the inherited access control list.
  const directoryMask = process.platform === "win32" ? 0o600 : 0o777;
  const directoryAccess = process.platform === "win32" ? 0o600 : 0o700;
  const fileMask = process.platform === "win32" ? 0o600 : 0o777;
  expect((await fs.stat(reportDirectory)).mode & directoryMask).toBe(
    directoryAccess,
  );
  for (const fileName of ["full-lock-audit.json", "full-lock-audit.log"])
    expect(
      (await fs.stat(path.join(reportDirectory, fileName))).mode & fileMask,
    ).toBe(0o600);
});

it("blocks a denied identifier inside a reviewed composite expression", async () => {
  const licenseExpression = "MIT OR GPL-3.0-only";
  const repoRoot = await createLegalFixture({
    packages: [{ name: "tainted", license: licenseExpression }],
    rootDependencies: { tainted: "^1" },
    policy: {
      ...BASE_POLICY,
      reviewedDecisions: [
        {
          packageName: "tainted",
          version: "1.0.0",
          licenseExpression,
          requiredScope: "production",
          disposition: "Reviewed identity used to prove deny precedence.",
        },
      ],
    },
  });

  const report = await auditFullLock({ repoRoot });

  expect(report.findings).toContainEqual(
    expect.objectContaining({ code: "denied-spdx-identifier" }),
  );
});

it("detects exact source drift for MPL in a composite expression", async () => {
  const expression = "MIT AND MPL-2.0";
  const repoRoot = await createLegalFixture({
    packages: [
      {
        name: "media",
        license: expression,
        resolved: "https://registry.example.test/media/-/different.tgz",
      },
    ],
    rootDependencies: { media: "^1" },
    policy: {
      ...BASE_POLICY,
      reviewedDecisions: [
        {
          packageName: "media",
          version: "1.0.0",
          licenseExpression: expression,
          requiredScope: "production",
          disposition: "Redistribute the license and exact source.",
          correspondingSourceUrl:
            "https://registry.example.test/media/-/media-1.0.0.tgz",
        },
      ],
    },
  });

  const report = await auditFullLock({ repoRoot });

  expect(report.findings).toContainEqual(
    expect.objectContaining({ code: "corresponding-source-mismatch" }),
  );
});

it("checks the acquired OSI source, final LICENSE, and exact transformation", async () => {
  const repoRoot = await createLegalFixture();
  await fs.writeFile(
    path.join(repoRoot, "LICENSE"),
    "MIT with formatting drift\n",
  );

  const report = await auditFullLock({ repoRoot });

  expect(report.findings).toContainEqual(
    expect.objectContaining({ code: "project-license-bytes" }),
  );
  expect(report.findings).toContainEqual(
    expect.objectContaining({ code: "project-license-transformation" }),
  );
});

it("rejects a separately pinned LICENSE that is not derived from the acquired source", async () => {
  const forgedLicense = "MIT License\n\nCopyright (c) 2026 Other\n";
  const repoRoot = await createLegalFixture({
    policy: {
      ...BASE_POLICY,
      projectLicense: {
        ...BASE_POLICY.projectLicense,
        expectedSha256: createHash("sha256")
          .update(forgedLicense)
          .digest("hex"),
      },
    },
  });
  await fs.writeFile(path.join(repoRoot, "LICENSE"), forgedLicense);

  const report = await auditFullLock({ repoRoot });

  expect(report.findings).not.toContainEqual(
    expect.objectContaining({ code: "project-license-bytes" }),
  );
  expect(report.findings).toContainEqual(
    expect.objectContaining({ code: "project-license-transformation" }),
  );
});
