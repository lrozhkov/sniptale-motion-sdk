import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe("product lint applicability", () => {
  it("rejects every mandatory unsafe and Promise failure with the installed engine", () => {
    const base = resolve(".tmp/tests");
    mkdirSync(base, { recursive: true });
    const root = mkdtempSync(join(base, "product-lint-"));
    roots.push(root);
    mkdirSync(join(root, "src"));
    writeFileSync(
      join(root, "tsconfig.json"),
      JSON.stringify({ extends: resolve("tsconfig.json"), include: ["src"] }),
    );
    writeFileSync(
      join(root, "src", "probe.ts"),
      `
      declare const foreign: any;
      const value: { x: number } = foreign;
      function consume(input: number) { return input; }
      consume(foreign);
      function read(): number { return foreign; }
      foreign();
      const member: unknown = foreign.member;
      async function action() { await Promise.resolve(); }
      action();
      setTimeout(action, 0);
      export { value, read, member };
    `,
    );
    const result = spawnSync(
      process.execPath,
      [
        resolve("node_modules/oxlint/bin/oxlint"),
        "--type-aware",
        "--no-ignore",
        "--config",
        resolve("tooling/configs/qa/oxlint.json"),
        "--format",
        "json",
        "src/probe.ts",
      ],
      { cwd: root, encoding: "utf8", timeout: 15_000 },
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    const report: unknown = JSON.parse(result.stdout);
    const codes = diagnosticCodes(report);
    for (const rule of [
      "no-explicit-any",
      "no-unsafe-assignment",
      "no-unsafe-argument",
      "no-unsafe-return",
      "no-unsafe-call",
      "no-unsafe-member-access",
      "no-floating-promises",
      "no-misused-promises",
    ]) {
      expect(codes).toContain(`typescript(${rule})`);
    }
  });
});

function diagnosticCodes(value: unknown): Set<string> {
  if (
    value === null ||
    typeof value !== "object" ||
    !("diagnostics" in value) ||
    !Array.isArray(value.diagnostics)
  )
    throw new Error("Invalid lint output.");
  const entries: unknown[] = value.diagnostics;
  const codes = new Set<string>();
  for (const entry of entries) {
    if (
      entry !== null &&
      typeof entry === "object" &&
      "code" in entry &&
      typeof entry.code === "string"
    )
      codes.add(entry.code);
  }
  return codes;
}
