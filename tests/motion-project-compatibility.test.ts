import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { initProject, newEffect, readProject } from "../src/apps/cli/project";
import { readProjectContract } from "../src/apps/cli/project-contract";
import { runMotionCli } from "../src/apps/cli/commands";
import { MOTION_COMPATIBILITY } from "../src/shared/compatibility";

const roots: string[] = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
async function fixture() {
  await mkdir(resolve(".tmp/tests"), { recursive: true });
  const root = await mkdtemp(resolve(".tmp/tests/compatibility-"));
  roots.push(root);
  await initProject(root, ".", "0.1.0");
  return root;
}
describe("project compatibility before writes", () => {
  it("rejects a selected incompatible project before browser probing or update network access", async () => {
    const root = await fixture();
    const file = join(root, "sniptale-motion.json");
    await writeFile(
      file,
      JSON.stringify({
        schemaVersion: "future",
        effectSchema: MOTION_COMPATIBILITY.effectSchema,
      }),
    );
    const request = vi.fn(async () => new Response("{}", { status: 404 }));
    vi.stubGlobal("fetch", request);
    const context = {
      cwd: root,
      packageRoot: root,
      version: "0.1.0",
      stdout: () => {},
      stderr: () => {},
    };
    expect(
      await runMotionCli(["doctor", "--project", "", "--json"], context),
    ).toBe(1);
    expect(
      await runMotionCli(["check-update", "--project", ".", "--json"], context),
    ).toBe(1);
    expect(request).not.toHaveBeenCalled();
    expect(await readdir(join(root, "effects"))).toEqual([]);
  });
  it("records a compatibility generation and reads legacy v1 without migrating its bytes", async () => {
    const root = await fixture();
    const file = join(root, "sniptale-motion.json");
    expect((await readProjectContract(root)).contract).toMatchObject({
      toolkitCompatibility: MOTION_COMPATIBILITY.toolkitCompatibility,
      legacy: false,
    });
    const original = JSON.stringify({
      schemaVersion: MOTION_COMPATIBILITY.projectSchema,
      effectSchema: MOTION_COMPATIBILITY.effectSchema,
      createdWith: "0.1.0",
    });
    await writeFile(file, original);
    expect((await readProjectContract(root)).contract.legacy).toBe(true);
    await newEffect(root, "new-effect", "standalone");
    expect(await readFile(file, "utf8")).toBe(original);
  });
  it.each(["schemaVersion", "effectSchema", "toolkitCompatibility"])(
    "rejects incompatible %s before creating effects or starting Studio",
    async (key) => {
      const root = await fixture();
      const file = join(root, "sniptale-motion.json");
      const value: unknown = JSON.parse(await readFile(file, "utf8"));
      if (!value || typeof value !== "object") throw new Error("fixture");
      const original = JSON.stringify({
        ...value,
        [key]: "SECRET_FUTURE_FORMAT",
      });
      await writeFile(file, original);
      await expect(readProject(root)).rejects.toMatchObject({
        code: "PROJECT_VERSION",
      });
      await expect(
        newEffect(root, "blocked", "standalone"),
      ).rejects.toMatchObject({ code: "PROJECT_VERSION" });
      let output = "";
      expect(
        await runMotionCli(["studio", "--no-open", "--json"], {
          cwd: root,
          packageRoot: root,
          version: "0.1.0",
          stdout: (text) => {
            output += text;
          },
          stderr: () => {},
        }),
      ).toBe(1);
      expect(output).not.toContain("SECRET_FUTURE_FORMAT");
      expect(await readdir(join(root, "effects"))).toEqual([]);
      expect(await readFile(file, "utf8")).toBe(original);
    },
  );
});
