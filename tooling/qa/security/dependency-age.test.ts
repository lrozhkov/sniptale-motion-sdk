import { describe, expect, it } from "vitest";
import {
  inspectDependencyAge,
  readRegistryPackages,
} from "./dependency-age.ts";

describe("dependency release age", () => {
  const now = Date.parse("2026-10-30T12:00:00Z");
  const packages: [{ name: string; version: string }] = [
    { name: "example", version: "1.0.0" },
  ];
  const metadata = (published: string) => ({
    example: { time: { "1.0.0": published } },
  });
  it("accepts seven complete days and rejects missing, future and younger release times", () => {
    expect(
      inspectDependencyAge(packages, metadata("2026-10-23T12:00:00Z"), now),
    ).toEqual([]);
    for (const time of [
      "2026-10-23T12:00:01Z",
      "2026-10-31T00:00:00Z",
      "invalid",
    ]) {
      expect(inspectDependencyAge(packages, metadata(time), now)).toHaveLength(
        1,
      );
    }
    expect(inspectDependencyAge(packages, {}, now)).toHaveLength(1);
  });
  it("only accepts an exact vulnerability fix until the seven-day window ends", () => {
    const fix = {
      name: "example",
      version: "1.0.0",
      advisory: "https://github.com/advisories/GHSA-1234-5678-9abc",
      reason: "Fixes verified code injection",
      expiresAt: "2026-11-05T12:00:00Z",
    };
    const source = metadata("2026-10-29T12:00:00Z");
    expect(inspectDependencyAge(packages, source, now, [fix])).toEqual([]);
    for (const invalid of [
      { ...fix, name: "*" },
      { ...fix, version: "*" },
      { ...fix, expiresAt: "2026-10-30T12:00:00Z" },
      { ...fix, expiresAt: "2026-11-06T00:00:00Z" },
      { ...fix, advisory: "https://example.org/fix" },
    ]) {
      expect(
        inspectDependencyAge(packages, source, now, [invalid]),
      ).toHaveLength(1);
    }
  });
  it("rejects non-registry dependencies and missing integrity before installation", () => {
    const entry = {
      version: "1.0.0",
      resolved: "https://registry.npmjs.org/example/-/example-1.0.0.tgz",
      integrity: `sha512-${Buffer.alloc(64, 1).toString("base64")}`,
    };
    const lock = (value: object) => ({
      lockfileVersion: 3,
      packages: { "": {}, "node_modules/example": value },
    });
    expect(readRegistryPackages(lock(entry))).toEqual([
      { ...packages[0], resolved: entry.resolved, integrity: entry.integrity },
    ]);
    for (const invalid of [
      { ...entry, resolved: "https://example.org/file.tgz" },
      { ...entry, link: true },
      { ...entry, integrity: "sha1-abc" },
      { ...entry, version: "latest" },
    ]) {
      expect(() => readRegistryPackages(lock(invalid))).toThrow(
        /exact registry/u,
      );
    }
  });
  it("rejects registry identity drift and obsolete temporary fixes", () => {
    const item = {
      ...packages[0],
      integrity: "locked",
      resolved: "locked-url",
    };
    const evidence = {
      example: {
        time: { "1.0.0": "2026-10-01T00:00:00Z" },
        versions: {
          "1.0.0": { dist: { integrity: "other", tarball: "locked-url" } },
        },
      },
    };
    expect(inspectDependencyAge([item], evidence, now)).toEqual([
      expect.stringContaining("differs from registry"),
    ]);
    const fix = {
      ...packages[0],
      reason: "Security fix",
      advisory: "https://github.com/advisories/GHSA-1234-5678-9abc",
      expiresAt: "2026-11-01T00:00:00Z",
    };
    expect(
      inspectDependencyAge(packages, metadata("2026-10-01T00:00:00Z"), now, [
        fix,
      ]),
    ).toEqual([expect.stringContaining("obsolete")]);
  });
});
