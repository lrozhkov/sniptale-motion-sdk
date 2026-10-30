import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { formatSource, loadFormattingOptions } from "./options.mjs";

describe("canonical formatting", () => {
  it.each([
    ["example.ts", "const value:number=1;"],
    ["example.js", "export const value={x:1,y:2};"],
    ["example.json", '{"x":1,"y":[2,3]}'],
    ["example.css", ".item{color:red;background:white}"],
    ["example.html", '<div class="item"><span>text</span></div>'],
    ["example.yml", "name:   example\non: [push,pull_request]\n"],
  ])(
    "formats %s idempotently with the shared configuration",
    async (name, source) => {
      const formatted = await formatSource(name, source);
      expect(formatted.endsWith("\n")).toBe(true);
      expect(await formatSource(name, formatted)).toBe(formatted);
    },
  );

  it("preserves schema JSON values and rejects invalid TypeScript", async () => {
    const source = '{"if":{"type":"object"},"then":{"required":["x"]}}';
    expect(JSON.parse(await formatSource("schema.json", source))).toEqual(
      JSON.parse(source),
    );
    await expect(formatSource("broken.ts", "const = ;")).rejects.toThrow(
      "Cannot format",
    );
  });

  it("rejects malformed source through the actual installed CLI", () => {
    const cli = resolve("node_modules/oxfmt/bin/oxfmt");
    const good = spawnSync(
      process.execPath,
      [cli, "--stdin-filepath", "example.ts", "--config", ".oxfmtrc.json"],
      { input: "const value=1;", encoding: "utf8" },
    );
    expect(good.status, good.stderr).toBe(0);
    expect(good.stdout).toContain("const value = 1;");
    const bad = spawnSync(
      process.execPath,
      [cli, "--stdin-filepath", "example.ts", "--config", ".oxfmtrc.json"],
      { input: "const = ;", encoding: "utf8" },
    );
    expect(bad.status).not.toBe(0);
    expect(`${bad.stdout}${bad.stderr}`).not.toBe("");
  });

  it("protects authored text, legal bytes, embedded source and import order", () => {
    const ignore = readFileSync(".oxfmtignore", "utf8").split(/\r?\n/u);
    for (const path of ["*.md", "NOTICE", "LICENSE", "LICENSES/**"])
      expect(ignore).toContain(path);
    expect(loadFormattingOptions()).toMatchObject({
      proseWrap: "never",
      sortImports: false,
      sortPackageJson: false,
      embeddedLanguageFormatting: "off",
    });
    const editor = JSON.parse(readFileSync(".vscode/settings.json", "utf8"));
    expect(editor["[markdown]"]["editor.formatOnSave"]).toBe(false);
  });
});
