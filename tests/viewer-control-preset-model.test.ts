import { describe, expect, it } from "vitest";
import { readControlPresetOptions } from "../src/apps/viewer/panels/control-preset-model.js";

describe("control preset selector boundary", () => {
  it("reads display fields and preserves valid primitive values without altering the source", () => {
    const source = {
      id: "soft",
      label: { ru: "Мягко", en: "Soft" },
      theme: { id: "warm", label: "Warm" },
      values: { opacity: 0.4, color: "#fff" },
      extension: { keep: true },
    };
    const before = structuredClone(source);
    expect(readControlPresetOptions([source])).toEqual([
      {
        id: source.id,
        label: source.label,
        theme: source.theme,
        values: source.values,
      },
    ]);
    expect(source).toEqual(before);
  });

  it("does not coerce malformed selector values or accept incomplete themes", () => {
    const calls: string[] = [];
    const foreign = {
      valueOf() {
        calls.push("number");
        return 1;
      },
    };
    const base = { id: "preset", theme: { id: "theme" }, values: {} };
    expect(
      readControlPresetOptions([
        null,
        [],
        {},
        { ...base, theme: {} },
        { ...base, values: { opacity: foreign } },
        { ...base, values: { opacity: NaN } },
      ]),
    ).toEqual([]);
    expect(readControlPresetOptions({ presets: [base] })).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("keeps special record keys as own data properties", () => {
    const values: unknown = JSON.parse(
      '{"__proto__":"literal","color":"none"}',
    );
    const [preset] = readControlPresetOptions([
      { id: "preset", theme: { id: "theme" }, values },
    ]);
    expect(preset?.values).toHaveProperty("__proto__", "literal");
    expect(Object.getPrototypeOf(preset?.values)).toBe(Object.prototype);
  });
});
