import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  inspectSkillKit,
  parseSkillKit,
  type SkillKit,
} from "../src/apps/cli/skill-kit";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
async function fixture() {
  const base = resolve(".tmp/tests");
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(join(base, "skill kit "));
  roots.push(root);
  const runtime = [
    "bin/sniptale-motion.mjs",
    "apps/viewer/index.html",
    "apps/sandbox/sandbox.html",
    "schemas/sniptale-effect-v1.schema.json",
    "node_modules/playwright-core/package.json",
  ].sort();
  const skill = [
    "skills/create-effect/SKILL.md",
    "skills/create-effect/references/contract.md",
  ];
  for (const path of [...runtime, ...skill]) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), path);
  }
  const runtimeFiles = runtime.map((path) => ({ path, sha256: hash(path) }));
  const skillFiles = skill.map((path) => ({ path, sha256: hash(path) }));
  const kit: SkillKit = {
    schemaVersion: "sniptale.motion-skill-kit.v1",
    toolkitVersion: "0.1.0",
    runtimeDigest: hash(JSON.stringify(runtimeFiles)),
    skillDigest: hash(JSON.stringify(skillFiles)),
    installerVersion: "1.7.4",
    installerNode: ">=22.20.0",
    runtimeFiles,
    skillFiles,
  };
  await writeFile(join(root, "skill-kit.json"), JSON.stringify(kit));
  await writeFile(
    join(root, "skills/create-effect/references/toolkit.json"),
    JSON.stringify({
      schemaVersion: kit.schemaVersion,
      toolkitVersion: kit.toolkitVersion,
      runtimeDigest: kit.runtimeDigest,
      skillDigest: kit.skillDigest,
    }),
  );
  const context = {
    cwd: root,
    packageRoot: root,
    version: "0.1.0",
    stdout: () => {},
    stderr: () => {},
  };
  return { root, context, kit };
}
describe("installed skill identity", () => {
  it("returns verified physical CLI and skill locations with a pinned optional installer", async () => {
    const { root, context, kit } = await fixture();
    const value = await inspectSkillKit(context, "ru");
    expect(value).toMatchObject({
      ok: true,
      toolkitVersion: "0.1.0",
      runtimeDigest: kit.runtimeDigest,
      skillDigest: kit.skillDigest,
      skill: { path: join(root, "skills/create-effect") },
      cli: { entry: join(root, "bin/sniptale-motion.mjs") },
      installer: {
        optional: true,
        version: "1.7.4",
        env: { DISABLE_TELEMETRY: "1", DO_NOT_TRACK: "1" },
      },
    });
    expect(await readFile(join(root, "bin/sniptale-motion.mjs"), "utf8")).toBe(
      "bin/sniptale-motion.mjs",
    );
  });
  it.each(["bin/sniptale-motion.mjs", "skills/create-effect/SKILL.md"])(
    "rejects changed bytes in %s without printing their contents",
    async (path) => {
      const { root, context } = await fixture();
      await writeFile(join(root, path), "SECRET_MARKER");
      await expect(inspectSkillKit(context, "en")).rejects.toMatchObject({
        code: "SKILL_KIT",
      });
      await expect(inspectSkillKit(context, "en")).rejects.not.toThrow(
        /SECRET_MARKER/,
      );
    },
  );
  it("rejects a descriptor copied from another build or a mismatched toolkit version", async () => {
    const { root, context } = await fixture();
    await expect(
      inspectSkillKit({ ...context, version: "0.2.0" }, "ru"),
    ).rejects.toMatchObject({ code: "SKILL_KIT" });
    await writeFile(
      join(root, "skills/create-effect/references/toolkit.json"),
      "{}",
    );
    await expect(inspectSkillKit(context, "ru")).rejects.toMatchObject({
      code: "SKILL_KIT",
    });
  });
  it("rejects malformed, escaping, unsorted or incomplete manifest rows", async () => {
    const { kit } = await fixture();
    expect(parseSkillKit(kit)).toEqual(kit);
    for (const invalid of [
      { ...kit, runtimeDigest: "x" },
      { ...kit, installerVersion: "latest" },
      { ...kit, runtimeFiles: [...kit.runtimeFiles].reverse() },
      { ...kit, runtimeFiles: [{ path: "../SECRET", sha256: "0".repeat(64) }] },
      { ...kit, skillFiles: [] },
    ])
      expect(parseSkillKit(invalid)).toBeNull();
  });
  it("rejects symlink escapes from a listed runtime file", async () => {
    const { root, context } = await fixture();
    const outside = await fixture();
    const path = join(root, "bin/sniptale-motion.mjs");
    await rm(path);
    await symlink(join(outside.root, "bin/sniptale-motion.mjs"), path);
    await expect(inspectSkillKit(context, "en")).rejects.toMatchObject({
      code: "SKILL_KIT",
    });
  });
});
