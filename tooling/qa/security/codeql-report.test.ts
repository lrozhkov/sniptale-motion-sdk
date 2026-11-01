import { describe, expect, it } from "vitest";
import { inspectCodeqlReport } from "./codeql-report.ts";

const report = (results: unknown[], executionSuccessful = true) => ({
  version: "2.1.0",
  runs: [
    {
      tool: { driver: { name: "CodeQL" } },
      invocations: [{ executionSuccessful }],
      results,
    },
  ],
});
describe("CodeQL report admission", () => {
  it("accepts a completed empty result and surfaces every finding", () => {
    expect(inspectCodeqlReport(report([]))).toEqual([]);
    expect(
      inspectCodeqlReport(
        report([
          {
            ruleId: "js/path-injection",
            message: { text: "unsafe path" },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: "src/example.ts" },
                },
              },
            ],
          },
        ]),
      ),
    ).toEqual(["js/path-injection: unsafe path"]);
  });
  it("rejects incomplete, failed, and malformed reports", () => {
    for (const value of [
      null,
      {},
      { version: "2.1.0", runs: [] },
      report([], false),
      report([{}]),
      { version: "2.1.0", runs: [{ tool: {}, results: [] }] },
    ])
      expect(() => inspectCodeqlReport(value)).toThrow(/CodeQL|SARIF/u);
  });
});

it("keeps every owned finding and excludes only files outside the declared input owners", () => {
  const result = (uri: string) => ({
    ruleId: "js/example",
    message: { text: "fixture" },
    locations: [{ physicalLocation: { artifactLocation: { uri } } }],
  });
  expect(
    inspectCodeqlReport(
      report([
        result("src/example.ts"),
        result("tooling/ci/example.ts"),
        result(".tmp/codeql-toolchain/models/example.js"),
      ]),
    ),
  ).toEqual(["js/example: fixture", "js/example: fixture"]);
  expect(() =>
    inspectCodeqlReport(report([result("src/../../outside.ts")])),
  ).toThrow("escapes");
  expect(() =>
    inspectCodeqlReport(report([result("file:///outside.ts")])),
  ).toThrow("source URI");
});
