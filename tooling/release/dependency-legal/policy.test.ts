import { expect, it } from "vitest";

import { checkLegalSettings, relativeRepoPath } from "./boundary.mjs";
import { BASE_POLICY } from "./test-support";

const COMMIT = "a".repeat(40);

it("accepts exact dispositions without accepting waiver-shaped fields", () => {
  const checked = checkLegalSettings({
    ...BASE_POLICY,
    reviewedDecisions: [
      {
        packageName: "media",
        version: "1.0.0",
        licenseExpression: "MIT AND MPL-2.0",
        requiredScope: "production",
        disposition: "Redistribute the license and the exact source archive.",
        correspondingSourceUrl:
          "https://registry.example.test/media/-/media-1.0.0.tgz",
      },
    ],
  });

  expect(checked.reviewedDecisions).toHaveLength(1);
  expect(() =>
    checkLegalSettings({ ...BASE_POLICY, reviewedExceptions: [] }),
  ).toThrow("unsupported field: reviewedExceptions");
  expect(() =>
    checkLegalSettings({
      ...BASE_POLICY,
      reviewedDecisions: [
        {
          packageName: "alpha",
          version: "1.0.0",
          licenseExpression: "Python-2.0",
          requiredScope: "development-only",
          disposition: "Temporary waiver for a known dependency.",
        },
      ],
    }),
  ).toThrow("not debt acceptance");
});

it("requires source for MPL inside a composite expression", () => {
  expect(() =>
    checkLegalSettings({
      ...BASE_POLICY,
      reviewedDecisions: [
        {
          packageName: "media",
          version: "1.0.0",
          licenseExpression: "MIT OR MPL-2.0",
          requiredScope: "production",
          disposition: "Redistribute the legal material.",
        },
      ],
    }),
  ).toThrow("exact corresponding-source URL");
});

it("allows only commit-addressed pinned provenance", () => {
  const pinned = {
    packageName: "alpha",
    version: "1.0.0",
    licenseExpression: "MIT",
    sourcePath: "tooling/release/dependency-legal/sources/alpha.LICENSE",
    originUrl: `https://raw.example.test/alpha/${COMMIT}/LICENSE`,
    sha256: "b".repeat(64),
    packageResolved: "https://registry.example.test/alpha/-/alpha-1.0.0.tgz",
    packageIntegrity: "sha512-alpha",
  };
  expect(
    checkLegalSettings({ ...BASE_POLICY, pinnedSources: [pinned] })
      .pinnedSources[0].originUrl,
  ).toContain(COMMIT);

  for (const mutableOrigin of [
    "https://raw.example.test/alpha/main/LICENSE",
    "https://raw.example.test/alpha/v1.0.0/LICENSE",
  ]) {
    expect(() =>
      checkLegalSettings({
        ...BASE_POLICY,
        pinnedSources: [{ ...pinned, originUrl: mutableOrigin }],
      }),
    ).toThrow("full commit hash");
  }
});

it("rejects path traversal before filesystem access", () => {
  expect(() => relativeRepoPath("../outside", "fixture path")).toThrow(
    "repository-relative path",
  );
  expect(() => relativeRepoPath("safe/../../outside", "fixture path")).toThrow(
    "repository-relative path",
  );
});
