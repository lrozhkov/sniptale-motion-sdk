import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseCodeqlToolchain } from "./codeql-toolchain.ts";
const locked: unknown = JSON.parse(
  readFileSync("tooling/configs/codeql/toolchain.json", "utf8"),
);
describe("CodeQL bundle admission", () => {
  it("accepts the exact aged bundle", () => {
    expect(parseCodeqlToolchain(locked).version).toBe("2.27.2");
  });
  it("rejects fresh tools, identity drift, and arbitrary suites", () => {
    const value = parseCodeqlToolchain(locked);
    const now = Date.now();
    const valid = {
      ...value,
      publishedAt: new Date(now - 8 * 86400000).toISOString(),
    };
    for (const replacement of [
      { publishedAt: new Date(now - 86400000).toISOString() },
      { sha256: "invalid" },
      { url: "https://example.test/codeql" },
      { version: "latest" },
      { querySuite: "arbitrary" },
    ])
      expect(() =>
        parseCodeqlToolchain({ ...valid, ...replacement }, now),
      ).toThrow(/Invalid/u);
  });
});
