import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { mkdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  prepareSmokeOutputDirectory,
  resolveSmokeOutputDirectory,
} from "../tooling/test/smoke/runtime.mjs";

describe("smoke runner ownership", () => {
  it("keeps browser smoke behind a thin runner and domain scenarios", () => {
    const runner = readFileSync(
      join(process.cwd(), "tooling/test/smoke/run.mjs"),
      "utf8",
    );

    expect(runner.split("\n").length).toBeLessThanOrEqual(80);
    expect(runner).toContain('from "./runtime.mjs"');
    expect(runner).toContain(
      'from "../../../tests/smoke/scenarios/main-flow.mjs"',
    );
  });

  it("routes generated inputs and browser evidence below the QA temporary owner", () => {
    const runtime = readFileSync(
      join(process.cwd(), "tooling/test/smoke/runtime.mjs"),
      "utf8",
    );

    expect(runtime).toContain('.tmp/qa/smoke/public"');
    expect(runtime).not.toContain('"test-output"');
    expect(runtime).not.toContain('".tmp/public"');

    const root = process.cwd();
    expect(resolveSmokeOutputDirectory(undefined, root)).toBe(
      resolve(root, ".tmp/qa/browser"),
    );
    expect(resolveSmokeOutputDirectory(".tmp/qa/custom", root)).toBe(
      resolve(root, ".tmp/qa/custom"),
    );
    for (const output of [".tmp", "test-output", "../outside"]) {
      expect(() => resolveSmokeOutputDirectory(output, root)).toThrow(
        "must stay below",
      );
    }
  });

  it("rejects smoke output through a symlinked temporary ancestor", async () => {
    const root = mkdtempSync(join(tmpdir(), "sniptale-smoke-root-"));
    const outside = mkdtempSync(join(tmpdir(), "sniptale-smoke-outside-"));
    try {
      await mkdir(resolve(root, ".tmp"));
      await symlink(outside, resolve(root, ".tmp/external"), "dir");
      const output = resolveSmokeOutputDirectory(".tmp/external/browser", root);

      await expect(prepareSmokeOutputDirectory(root, output)).rejects.toThrow(
        "cannot cross symlink",
      );
    } finally {
      rmSync(root, { force: true, recursive: true });
      rmSync(outside, { force: true, recursive: true });
    }
  });
});
