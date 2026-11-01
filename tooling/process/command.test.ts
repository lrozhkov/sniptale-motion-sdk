import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveToolCommand } from "./command.ts";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
function fixture() {
  const parent = resolve(".tmp/tests");
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(join(parent, "tool process with spaces "));
  roots.push(root);
  return root;
}

describe("portable repository commands", () => {
  it("passes non-npm commands through without interpreting arguments", () => {
    const args = ["path with spaces", "$(not-a-command)", "a&b"];
    expect(resolveToolCommand(process.execPath, args, {})).toEqual({
      command: process.execPath,
      args,
    });
  });
  it("executes the npm JavaScript entrypoint with Node and preserves shell characters", () => {
    const root = fixture();
    const cli = join(root, "npm-cli.js");
    writeFileSync(
      cli,
      "process.stdout.write(JSON.stringify(process.argv.slice(2)));\n",
    );
    const args = [
      "run",
      "fixture",
      "--",
      "path with spaces",
      "$(not-a-command)",
      "a&b",
      'a"b',
    ];
    const invocation = resolveToolCommand("npm", args, { npm_execpath: cli });
    expect(invocation.command).toBe(process.execPath);
    const result: unknown = JSON.parse(
      execFileSync(invocation.command, invocation.args, { encoding: "utf8" }),
    );
    expect(result).toEqual(args);
  });
  it.each([undefined, "npm.cmd", "relative/npm-cli.js", resolve("npm.cmd")])(
    "rejects an absent or non-JavaScript npm entrypoint: %s",
    (npm_execpath) => {
      expect(() =>
        resolveToolCommand(
          "npm",
          ["run", "test"],
          npm_execpath === undefined ? {} : { npm_execpath },
        ),
      ).toThrow("Run repository QA through npm run");
    },
  );
  it("sets absolute repository temp paths before loading tsx from another working directory", () => {
    const root = fixture();
    const file = join(root, "typed entry.ts");
    writeFileSync(
      file,
      'import { tmpdir } from "node:os"; const typed: string = "ready"; process.stdout.write(JSON.stringify({ typed, temporary: tmpdir(), env: [process.env.TMPDIR, process.env.TMP, process.env.TEMP] }));',
    );
    const preload = resolve("tooling/process/environment.cjs");
    const expected = resolve(".tmp/runtime-tmp");
    const value: unknown = JSON.parse(
      execFileSync(
        process.execPath,
        ["--require", preload, "--import", "tsx", file],
        {
          cwd: root,
          encoding: "utf8",
          env: { ...process.env, TMPDIR: root, TMP: root, TEMP: root },
        },
      ),
    );
    expect(value).toEqual({
      typed: "ready",
      temporary: expected,
      env: [expected, expected, expected],
    });
  });
});
