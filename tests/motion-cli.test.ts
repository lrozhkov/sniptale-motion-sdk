import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runMotionCli } from "../src/apps/cli/commands.js";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(
    cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function fixture() {
  await mkdir(".tmp/tests", { recursive: true });
  const root = await mkdtemp(resolve(".tmp/tests/motion-cli-"));
  cleanup.push(root);
  return root;
}

async function invoke(cwd: string, ...args: string[]) {
  let stdout = "";
  let stderr = "";
  const exitCode = await runMotionCli(args, {
    cwd,
    packageRoot: cwd,
    version: "0.1.0",
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
  });
  return { exitCode, stdout, stderr };
}

describe("installed Motion CLI contracts", () => {
  it.each(["standalone", "targetEffect", "transition"])(
    "creates and validates %s without repository commands",
    async (kind) => {
      const root = await fixture();
      expect(
        (await invoke(root, "init", "проект с пробелами", "--json")).exitCode,
      ).toBe(0);
      const project = join(root, "проект с пробелами");
      expect(
        (await invoke(project, "new", "hello", "--kind", kind, "--json"))
          .exitCode,
      ).toBe(0);
      const result = await invoke(
        project,
        "validate",
        "effects/hello/effect.sniptale-effect.json",
        "--json",
      );
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: true,
        proof: { runtime: "not-run" },
      });
    },
  );

  it("rejects repeat creation without changing an existing effect or project", async () => {
    const root = await fixture();
    await invoke(root, "init");
    const manifest = await readFile(join(root, "sniptale-motion.json"), "utf8");
    expect((await invoke(root, "init", "--json")).exitCode).toBe(1);
    expect(await readFile(join(root, "sniptale-motion.json"), "utf8")).toBe(
      manifest,
    );
    await invoke(root, "new", "original");
    const file = join(root, "effects/original/effect.sniptale-effect.json");
    await writeFile(file, "user edit");
    expect((await invoke(root, "new", "original", "--json")).exitCode).toBe(1);
    expect(await readFile(file, "utf8")).toBe("user edit");
  });

  it.each([
    ["new", "hello", "--kind", "wrong"],
    ["validate", "--unknown"],
    ["doctor", "extra"],
    ["new"],
    ["export"],
    ["export", "input.json"],
    ["export", "input.json", "--output"],
    ["wat"],
    ["doctor", "--json", "--json"],
    ["doctor", "--locale", "fr"],
    ["doctor", "--browser-channel", "firefox"],
    ["browser"],
    ["browser", "chrome"],
    ["browser", "install", "--force"],
    ["prove"],
    ["prove", "file.json", "--browser-channel", "firefox"],
    ["prove", "file.json", "--output", "out.json"],
  ])("rejects invalid arguments: %j", async (...args) => {
    const result = await invoke(
      await fixture(),
      ...args,
      ...(args.includes("--json") ? [] : ["--json"]),
    );
    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "ARGUMENTS" }],
    });
  });

  it.each(["../escape", "con", "lpt1", "with.dot", "COM1", "a/b"])(
    "rejects unsafe effect identifier %s",
    async (id) => {
      const root = await fixture();
      await invoke(root, "init");
      const result = await invoke(root, "new", id, "--json");
      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({
        diagnostics: [{ code: "EFFECT_ID" }],
      });
    },
  );

  it("rejects an effects symlink outside the project", async () => {
    const root = await fixture();
    const outside = await fixture();
    await invoke(root, "init");
    await rm(join(root, "effects"), { recursive: true });
    await symlink(outside, join(root, "effects"), "junction");
    const result = await invoke(root, "new", "escape", "--json");
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      diagnostics: [{ code: "PROJECT_PATH" }],
    });
  });

  it("returns structured malformed JSON and missing-project failures", async () => {
    const root = await fixture();
    expect((await invoke(root, "new", "hello", "--json")).exitCode).toBe(1);
    await writeFile(join(root, "broken.json"), "{");
    const result = await invoke(root, "validate", "broken.json", "--json");
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "JSON_INVALID" }],
    });
    expect(result.stderr).toBe("");
  });

  it("serves both help locales and installed documentation", async () => {
    const root = await fixture();
    expect((await invoke(root, "--help")).stdout).toContain("Команды:");
    expect((await invoke(root, "--help", "--locale", "en")).stdout).toContain(
      "Commands:",
    );
    await writeFile(join(root, "README.md"), "Installed reference");
    expect((await invoke(root, "docs")).stdout).toBe("Installed reference");
    expect(
      JSON.parse((await invoke(root, "--version", "--json")).stdout),
    ).toEqual({ ok: true, version: "0.1.0" });
  });
});
