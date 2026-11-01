import { describe, expect, it } from "vitest";
import { assertEnglishProse, inspectWritingReport } from "./ste.ts";

const finding = (rule: string, level = "advisory-free") => ({
  file: "README.md",
  line: 1,
  col: 1,
  match: "fixture",
  rule,
  level,
  message: "fixture",
});
describe("writing report admission", () => {
  it("blocks structural failures without a blanket synonym exception", () => {
    expect(
      inspectWritingReport({
        hard_count: 3,
        violations: [
          finding("long-sentence"),
          finding("semicolon"),
          finding("synonym-rotation"),
          finding("passive-voice", "advisory"),
        ],
      }),
    ).toEqual({
      blockers: [
        "README.md:1: fixture",
        "README.md:1: fixture",
        "README.md:1: fixture",
      ],
      suggestions: 1,
      consumedNoise: [],
    });
  });
  it("rejects absent and malformed reports", () => {
    for (const value of [
      null,
      {},
      { violations: {} },
      { violations: [null] },
      { violations: [{ rule: "semicolon" }] },
    ])
      expect(() => inspectWritingReport(value)).toThrow("Invalid STE");
  });
});

it("requires English prose while preserving localized code examples", async () => {
  const { assertEnglishProse } = await import("./ste.ts");
  expect(() =>
    assertEnglishProse(
      'English text with `label.ru: Пример`.\n```json\n{"ru":"Пример"}\n```',
      "example.md",
    ),
  ).not.toThrow();
  expect(() =>
    assertEnglishProse("Русская инструкция вне примера.", "example.md"),
  ).toThrow("English");
});

it("requires a matching standalone closing fence", () => {
  for (const source of [
    "```text\nexample\n``` trailing prose",
    "```text\nexample\n~~~",
    "````text\nexample\n```",
    "~~~text\nexample",
  ])
    expect(() => assertEnglishProse(source, "example.md")).toThrow(
      "Unterminated Markdown code fence",
    );
  expect(() =>
    assertEnglishProse("````text\n``` literal fence\n````", "example.md"),
  ).not.toThrow();
  expect(() =>
    assertEnglishProse("~~~text\nПример\n~~~~  \nEnglish.", "example.md"),
  ).not.toThrow();
});
