import { describe, expect, it } from "vitest";
import {
  advisoryProvesSecurityFix,
  inspectDependencyConfiguration,
  readRegistryPackages,
  readSecurityFixes,
  verifyManifestLock,
} from "./dependency-admission.ts";

const now = Date.parse("2026-10-30T12:00:00Z");
const integrity = `sha512-${Buffer.alloc(64, 1).toString("base64")}`;
const item = {
  version: "1.0.0",
  resolved: "https://registry.npmjs.org/example/-/example-1.0.0.tgz",
  integrity,
};
const lock = (entry: unknown, path = "node_modules/example") => ({
  lockfileVersion: 3,
  packages: { "": {}, [path]: entry },
});
const fix = {
  name: "example",
  version: "1.0.0",
  reason: "Fixes a verified vulnerability",
  advisory: "https://github.com/advisories/GHSA-2345-6789-cfgh",
  expiresAt: "2026-11-01T00:00:00Z",
};
const packages: [{ name: string; version: string }] = [
  { name: "example", version: "1.0.0" },
];
const npmrc =
  "registry=https://registry.npmjs.org/\nmin-release-age=7\nignore-scripts=true\nsave-exact=true\n";

describe("dependency admission", () => {
  it("binds exact direct versions and aliases to manifest and lock records", () => {
    const manifest = { dependencies: { alias: "npm:example@1.0.0" } };
    const locked = {
      packages: {
        "": manifest,
        "node_modules/alias": { ...item, name: "example" },
      },
    };
    expect(() => verifyManifestLock(manifest, locked)).not.toThrow();
    expect(() =>
      verifyManifestLock(
        { dependencies: { alias: "npm:example@2.0.0" } },
        locked,
      ),
    ).toThrow("differs");
    expect(() =>
      verifyManifestLock(manifest, { packages: { "": manifest } }),
    ).toThrow("lock record");
    expect(() =>
      verifyManifestLock(manifest, {
        packages: {
          "": manifest,
          "node_modules/alias": { ...item, name: "other" },
        },
      }),
    ).toThrow("locked identity");
    const range = { dependencies: { example: "^1.0.0" } };
    expect(() =>
      verifyManifestLock(range, {
        packages: { "": range, "node_modules/example": item },
      }),
    ).toThrow("exact version");
  });
  it("accepts registry aliases and nested locked dependencies", () => {
    expect(
      readRegistryPackages(
        lock({ ...item, name: "example" }, "node_modules/alias"),
      )[0],
    ).toMatchObject(packages[0]);
    expect(
      readRegistryPackages(
        lock(item, "node_modules/parent/node_modules/example"),
      )[0],
    ).toMatchObject(packages[0]);
  });
  it("rejects malformed lock records and identities before installing packages", () => {
    for (const input of [
      null,
      [],
      {},
      { lockfileVersion: 2, packages: {} },
      lock(null),
      lock([]),
      lock(item, "../node_modules/example"),
      lock(item, "node_modules/example/../../owner"),
    ]) {
      expect(() => readRegistryPackages(input)).toThrow(
        /lockfile|must be an object/u,
      );
    }
    for (const entry of [
      { ...item, version: "latest" },
      { ...item, link: true },
      { ...item, inBundle: true },
      { ...item, name: "../escape" },
      {
        ...item,
        resolved:
          "https://registry.npmjs.org/example/-/example-1.0.0.tgz?other",
      },
      {
        ...item,
        resolved: "https://registry.npmjs.org/example/-/../other.tgz",
      },
      { ...item, integrity: "sha512-YWJjZA==" },
    ]) {
      expect(() => readRegistryPackages(lock(entry))).toThrow(
        /exact registry/u,
      );
    }
  });
  it("fails conflicting copies of an exact package identity", () => {
    expect(() =>
      readRegistryPackages({
        lockfileVersion: 3,
        packages: {
          "node_modules/example": item,
          "node_modules/parent/node_modules/example": {
            ...item,
            integrity: `sha512-${Buffer.alloc(64, 2).toString("base64")}`,
          },
        },
      }),
    ).toThrow("conflicting integrity");
  });
  it("requires age protection and disabled installation lifecycle scripts", () => {
    expect(
      inspectDependencyConfiguration(
        { scripts: { test: "vitest run" } },
        npmrc,
      ),
    ).toEqual([]);
    for (const config of [
      npmrc.replace("min-release-age=7", "min-release-age=0"),
      npmrc.replace("ignore-scripts=true", "ignore-scripts=false"),
      `${npmrc}before=2100-01-01\n`,
      `${npmrc}min-release-age-exclude[]=*\n`,
      `${npmrc}min-release-age=0\n`,
    ]) {
      expect(inspectDependencyConfiguration({}, config).length).toBeGreaterThan(
        0,
      );
    }
    expect(
      inspectDependencyConfiguration(
        { scripts: { prepare: "untrusted" } },
        npmrc,
      ),
    ).toHaveLength(1);
  });
  it("rejects expired, unused, duplicated and broad security exceptions", () => {
    expect(readSecurityFixes([fix], packages, now)).toEqual([fix]);
    for (const records of [
      null,
      {},
      [null],
      [{ ...fix, name: "*" }],
      [{ ...fix, version: "*" }],
      [{ ...fix, reason: "" }],
      [{ ...fix, expiresAt: "2026-10-30T12:00:00Z" }],
      [{ ...fix, extra: true }],
      [fix, fix],
    ]) {
      expect(() => readSecurityFixes(records, packages, now)).toThrow(
        /security-fix record/iu,
      );
    }
    expect(() => readSecurityFixes([fix], [], now)).toThrow("unused");
  });
  it("requires a non-withdrawn advisory naming the exact patched npm release", () => {
    const advisory = {
      ghsa_id: "GHSA-2345-6789-cfgh",
      withdrawn_at: null,
      vulnerabilities: [
        {
          package: { ecosystem: "npm", name: "example" },
          first_patched_version: { identifier: "1.0.0" },
        },
      ],
    };
    expect(advisoryProvesSecurityFix(fix, advisory)).toBe(true);
    for (const raw of [
      null,
      {},
      { ...advisory, withdrawn_at: "2026-10-30" },
      { ...advisory, ghsa_id: "GHSA-other" },
      {
        ...advisory,
        vulnerabilities: [
          {
            package: { ecosystem: "npm", name: "other" },
            first_patched_version: { identifier: "1.0.0" },
          },
        ],
      },
      {
        ...advisory,
        vulnerabilities: [
          {
            package: { ecosystem: "npm", name: "example" },
            first_patched_version: { identifier: "1.0.1" },
          },
        ],
      },
    ]) {
      expect(advisoryProvesSecurityFix(fix, raw)).toBe(false);
    }
  });
});
