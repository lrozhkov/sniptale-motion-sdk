import { describe, expect, it, vi } from "vitest";
import {
  evaluateEffectV1Expression,
  readEffectV1Value,
} from "../src/apps/sandbox/runtime/effect-v1/expression";
import { trimPolyline } from "../src/apps/sandbox/runtime/effect-v1/path-drawing";
const scope = (item?: unknown) => ({
  context: { track: () => 0, resolveLayer: () => null },
  definitions: {},
  definitionCache: new Map<string, unknown>(),
  vars: {},
  item,
});
describe("Effect v1 evaluation boundaries", () => {
  it("does not invoke conversion hooks on foreign evaluated objects", () => {
    const convert = vi.fn<() => never>(() => {
      throw new Error("foreign conversion");
    });
    const item = { valueOf: convert, toString: convert };
    expect(
      evaluateEffectV1Expression(
        { op: "add", args: [{ op: "read", path: "item" }, 2] },
        scope(item),
      ),
    ).toBe(2);
    expect(
      evaluateEffectV1Expression(
        { op: "concat", args: [{ op: "read", path: "item" }, "!"] },
        scope(item),
      ),
    ).toBe("[object Object]!");
    expect(convert).not.toHaveBeenCalled();
  });
  it("does not expose inherited object properties through read paths", () => {
    expect(readEffectV1Value("item.constructor", scope({}))).toBeUndefined();
    expect(readEffectV1Value("item.__proto__", scope({}))).toBeUndefined();
  });
  it.each([[], [2], [[2]], [null], [1, 2]].map((item) => ({ item })))(
    "preserves JSON array conversion semantics: %j",
    ({ item }) => {
      const numeric = Number(item);
      expect(
        evaluateEffectV1Expression(
          { op: "add", args: [{ op: "read", path: "item" }, 0] },
          scope(item),
        ),
      ).toBe(Number.isFinite(numeric) ? numeric : 0);
      expect(
        evaluateEffectV1Expression(
          { op: "concat", args: [{ op: "read", path: "item" }] },
          scope(item),
        ),
      ).toBe(String(item));
    },
  );
  it("preserves own string and array indexing", () => {
    expect(readEffectV1Value("item.0", scope(["value"]))).toBe("value");
    expect(readEffectV1Value("item.length", scope("text"))).toBe(4);
  });
});
describe("polyline trimming boundaries", () => {
  it("returns an empty path for empty or nonfinite trim input", () => {
    expect(trimPolyline([], 0.5)).toEqual([]);
    expect(trimPolyline([], 0)).toEqual([]);
    expect(
      trimPolyline(
        [
          { x: 1, y: 2 },
          { x: 3, y: 4 },
        ],
        NaN,
      ),
    ).toEqual([]);
  });
});
