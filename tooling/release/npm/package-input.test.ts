import { describe, expect, it } from "vitest";
import { MOTION_COMPATIBILITY } from "../../../src/shared/compatibility.js";
import {
  checkBundledDependency,
  parseBuildManifest,
  parseCompiledVersion,
  parsePackResult,
  parseSkillInstaller,
} from "./package-input.ts";

const identity = { name: "@sniptale/motion", version: "0.1.0" };
function pack() {
  return {
    ...identity,
    filename: "sniptale-motion-0.1.0.tgz",
    files: [{ path: "bin/sniptale-motion.mjs" }],
  };
}

describe("npm candidate input boundaries", () => {
  it("accepts npm array and keyed results and owns the projected inventory", () => {
    const raw = pack();
    const expected = pack();
    expect(parsePackResult([raw], identity)).toEqual(expected);
    const result = parsePackResult({ [identity.name]: raw }, identity);
    raw.files.push({ path: "injected.ts" });
    expect(result).toEqual(expected);
  });

  it.each(
    [
      null,
      [],
      [pack(), pack()],
      [null],
      [{ ...pack(), name: "other" }],
      [{ ...pack(), version: "2.0.0" }],
      [{ ...pack(), filename: "../other.tgz" }],
      [{ ...pack(), files: {} }],
      [{ ...pack(), files: [null] }],
      [{ ...pack(), files: [{ path: 1 }] }],
      [{ ...pack(), files: [{ path: "../outside" }] }],
      [{ ...pack(), files: [{ path: "/absolute" }] }],
      [{ ...pack(), files: [{ path: "bin\\other" }] }],
      [{ ...pack(), files: [{ path: "bin//other" }] }],
      [{ ...pack(), files: [{ path: "same" }, { path: "same" }] }],
    ].map((value) => ({ value })),
  )("rejects malformed or foreign npm inventories: $value", ({ value }) => {
    expect(() => parsePackResult(value, identity)).toThrow(/npm pack/u);
  });

  it("requires the exact compiled compatibility contract", () => {
    expect(
      parseCompiledVersion(
        { version: "0.1.0", compatibility: MOTION_COMPATIBILITY },
        "0.1.0",
      ),
    ).toEqual({ version: "0.1.0", compatibility: MOTION_COMPATIBILITY });
    for (const compatibility of [
      null,
      {},
      { ...MOTION_COMPATIBILITY, projectSchema: "future" },
      { ...MOTION_COMPATIBILITY, extra: "unknown" },
    ]) {
      expect(() =>
        parseCompiledVersion({ version: "0.1.0", compatibility }, "0.1.0"),
      ).toThrow(/Compiled CLI/u);
    }
    expect(() =>
      parseCompiledVersion(
        { version: "0.2.0", compatibility: MOTION_COMPATIBILITY },
        "0.1.0",
      ),
    ).toThrow(/Compiled CLI/u);
  });

  it("rejects added runtime dependencies and changed package identities", () => {
    expect(() =>
      checkBundledDependency(
        { name: "semver", version: "1.0.0" },
        "semver",
        "1.0.0",
      ),
    ).not.toThrow();
    for (const value of [
      null,
      { name: "other", version: "1.0.0" },
      { name: "semver", version: "2.0.0" },
      { name: "semver", version: "1.0.0", dependencies: [] },
      { name: "semver", version: "1.0.0", dependencies: { added: "1" } },
    ]) {
      expect(() => checkBundledDependency(value, "semver", "1.0.0")).toThrow(
        /semver/u,
      );
    }
  });

  it("requires the pinned installer and an explicit minimum Node version", () => {
    expect(
      parseSkillInstaller(
        { name: "skills", version: "1.0.0", engines: { node: ">=22.20.0" } },
        "1.0.0",
      ),
    ).toEqual({ version: "1.0.0", engines: { node: ">=22.20.0" } });
    for (const node of [undefined, 22, "*", "^22.20.0"]) {
      expect(() =>
        parseSkillInstaller(
          { name: "skills", version: "1.0.0", engines: { node } },
          "1.0.0",
        ),
      ).toThrow(/skills|skill installer/u);
    }
    expect(() =>
      parseSkillInstaller(
        { name: "skills", version: "2.0.0", engines: { node: ">=22.20.0" } },
        "1.0.0",
      ),
    ).toThrow(/skill installer/u);
  });

  it("projects only manifest fields that are used for the package", () => {
    const raw = {
      ...identity,
      description: "Motion",
      license: "MIT",
      author: "Author",
      repository: "repo",
      homepage: "home",
      engines: { node: ">=22.12.0" },
      dependencies: { "playwright-core": "1.0.0", semver: "1.0.0" },
      devDependencies: { skills: "1.0.0" },
      scripts: { install: "unwanted" },
    };
    const parsed = parseBuildManifest(raw);
    raw.dependencies.semver = "2.0.0";
    expect(parsed.dependencies.semver).toBe("1.0.0");
    expect(parsed).not.toHaveProperty("scripts");
    expect(() => parseBuildManifest({ ...raw, engines: [] })).toThrow(
      /package\.json\.engines/u,
    );
    expect(() => parseBuildManifest({ ...raw, version: {} })).toThrow(
      /package\.json\.version/u,
    );
    expect(() =>
      parseBuildManifest({ ...raw, dependencies: { semver: "1.0.0" } }),
    ).toThrow(/package\.json\.dependencies\.playwright-core/u);
  });
});
