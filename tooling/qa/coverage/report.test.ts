import { describe, expect, it } from "vitest";
import { readCoverageReport } from "./report.ts";

const complete = {
  lines: { pct: 47 },
  statements: { pct: 46 },
  functions: { pct: 49 },
  branches: { pct: 50 },
};
describe("coverage evidence boundary", () => {
  it("reports the four observed percentages without a debt threshold", () => {
    expect(readCoverageReport({ total: complete })).toBe(
      "lines=47%, statements=46%, functions=49%, branches=50%",
    );
  });
  it.each([
    null,
    {},
    { total: {} },
    { total: { ...complete, lines: { pct: "47" } } },
    { total: { ...complete, lines: { pct: NaN } } },
    { total: { ...complete, lines: { pct: -1 } } },
    { total: { ...complete, lines: { pct: 101 } } },
  ])("rejects missing or malformed evidence %#", (value) => {
    expect(() => readCoverageReport(value)).toThrow("Coverage summary");
  });
});
