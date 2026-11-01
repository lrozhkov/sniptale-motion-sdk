import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { expect, it } from "vitest";

it("runs native duplication detection and rejects an injected substantial clone", () => {
  mkdirSync(resolve(".tmp/duplication-tests"), { recursive: true });
  const root = mkdtempSync(resolve(".tmp/duplication-tests/native-"));
  try {
    const source = Array.from(
      { length: 30 },
      (_, index) =>
        `export function operation${index}(value: number): number { return Math.max(value + ${index}, ${index}) * 3; }`,
    ).join("\n");
    writeFileSync(join(root, "first.ts"), source);
    const run = () =>
      spawnSync(
        process.execPath,
        [
          "node_modules/jscpd/run-jscpd.js",
          "--no-gitignore",
          "--config",
          "tooling/configs/qa/jscpd.json",
          "--reporters",
          "json",
          "--output",
          join(root, "report"),
          root,
        ],
        { encoding: "utf8", timeout: 30000 },
      );
    expect(run().status).toBe(0);
    writeFileSync(join(root, "second.ts"), source);
    expect(run().status).toBe(1);
    const configuration: unknown = JSON.parse(
      readFileSync("tooling/configs/qa/jscpd.json", "utf8"),
    );
    expect(configuration).toMatchObject({
      threshold: 0,
      minTokens: 100,
      minLines: 8,
      ignorePattern: [],
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 30000);
