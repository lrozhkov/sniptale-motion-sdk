import { describe, expect, it } from "vitest";
import { findCoercedValidationLookups } from "./validation-boundaries.mjs";

const owner = "src/sdk/effect-v1/timeline-validation.ts";
describe("validation receiving boundary guard", () => {
  it.each([
    "map.get(String(value))",
    "ids.has((Number(value)))",
    "values.includes(Boolean(value))",
    "map?.get(globalThis.String(value))",
    "fields[String(kind)]",
    "fields[(globalThis.Number(kind))]",
    "/^[a-z]+$/.test(String(value))",
  ])("rejects coercion in %s", (source) => {
    expect(findCoercedValidationLookups(owner, source)).toEqual([
      expect.stringContaining(
        `${owner}:1: validate identifier/enum types before lookup`,
      ),
    ]);
  });

  it("permits type checks, direct lookups, and diagnostic formatting", () => {
    expect(
      findCoercedValidationLookups(
        owner,
        'if (typeof value === "string" && ids.has(value)) map.get(value); report.error(String(value));',
      ),
    ).toEqual([]);
  });

  it("does not confuse source comments and string literals with operations", () => {
    expect(
      findCoercedValidationLookups(
        owner,
        '// ids.has(String(value))\nconst text = "map.get(String(value))";',
      ),
    ).toEqual([]);
  });

  it("applies only to the Effect v1 receiving validation domain", () => {
    expect(
      findCoercedValidationLookups(
        "src/apps/viewer/editor/model.ts",
        "map.get(String(value))",
      ),
    ).toEqual([]);
  });
});
