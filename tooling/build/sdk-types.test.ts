import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe("SDK declaration ownership", () => {
  it("rejects imports outside the SDK without emitting declarations beside source", () => {
    const base = resolve(".tmp/tests");
    mkdirSync(base, { recursive: true });
    const root = mkdtempSync(join(base, "sdk-emit-"));
    roots.push(root);
    mkdirSync(join(root, "sdk"));
    writeFileSync(join(root, "outside.ts"), "export const outside = 1;\n");
    writeFileSync(
      join(root, "sdk", "index.ts"),
      'export { outside } from "../outside.js";\n',
    );
    const config = join(root, "tsconfig.json");
    writeFileSync(
      config,
      JSON.stringify({
        extends: resolve("tooling/configs/typescript/sdk.json"),
        compilerOptions: { rootDir: "sdk", outDir: "dist" },
        include: ["sdk"],
      }),
    );
    const result = spawnSync(
      process.execPath,
      [resolve("node_modules/@typescript/native/bin/tsc"), "--project", config],
      { cwd: root, encoding: "utf8", timeout: 15_000 },
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("TS6059");
    expect(existsSync(join(root, "outside.d.ts"))).toBe(false);
    expect(existsSync(join(root, "outside.d.ts.map"))).toBe(false);
    expect(existsSync(join(root, "dist"))).toBe(false);
  });
});
