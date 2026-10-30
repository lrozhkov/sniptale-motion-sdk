import { describe, expect, it } from "vitest";
import { createEffectV1Diagnostics } from "../src/sdk/effect-v1/diagnostics.js";
import { validateEffectV1Expression } from "../src/sdk/effect-v1/expression-validation.js";
import type { EffectV1ReadReferences } from "../src/sdk/effect-v1/graph-model.js";

const references: EffectV1ReadReferences = {
  controlIds: new Set(["strength"]),
  layerIds: new Set(["title"]),
  trackIds: new Set(["entrance"]),
  definitionIds: new Set(["offset"]),
  runtimeInputs: new Set(["source"]),
};

describe("untrusted graph expression values", () => {
  const invalid: [unknown, string][] = [
    [[], "EXPRESSION_OP"],
    [{ op: 123 }, "EXPRESSION_OP"],
    [{ op: "unsupported" }, "EXPRESSION_OP"],
    [{ op: "add", args: "not-an-array" }, "EXPRESSION_ARGS_REQUIRED"],
    [{ op: "add", args: [1, Infinity] }, "EXPRESSION_NUMBER"],
    [{ op: "read", path: 7 }, "READ_PATH"],
    [{ op: "read", path: "controls.missing" }, "READ_REFERENCE_UNKNOWN"],
    [{ op: "select", value: true, values: [1] }, "EXPRESSION_SELECT_VALUES"],
    [{ op: "fallback", value: 1 }, "EXPRESSION_FIELD_REQUIRED"],
    [{ op: "abs", args: [1], executable: "code" }, "UNKNOWN_FIELD"],
  ];

  it.each(invalid)(
    "rejects malformed data %# without assuming its schema",
    (value, code) => {
      const report = createEffectV1Diagnostics();
      expect(() =>
        validateEffectV1Expression(value, "$.value", 0, report, references),
      ).not.toThrow();
      expect(report.diagnostics.map((item) => item.code)).toContain(code);
    },
  );

  it.each([
    null,
    false,
    0,
    "",
    { op: "read", path: "controls.strength" },
    { op: "select", value: true, values: [1, 0] },
  ])("accepts a supported expression %#", (value) => {
    const report = createEffectV1Diagnostics();
    validateEffectV1Expression(value, "$.value", 0, report, references);
    expect(report.diagnostics).toEqual([]);
  });
});
