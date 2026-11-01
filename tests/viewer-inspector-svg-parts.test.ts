import { describe, expect, it } from "vitest";
import {
  parseSvgPartIdList,
  resolveSvgSwatch,
} from "../src/apps/viewer/inspector/svg-part-fields.js";

describe("SVG inspector metadata boundaries", () => {
  it.each(
    [null, true, 12, ["a", 2], { toString: null }].map((value: unknown) => ({
      value,
    })),
  )("does not coerce foreign part-list values: %j", ({ value }) => {
    expect(parseSvgPartIdList(value)).toEqual([]);
    expect(resolveSvgSwatch(value)).toBe("#9aa5ae");
  });
  it("preserves canonical array ids without aliasing or CSV coercion", () => {
    const ids = ["glyph.rect-0", "part,with,commas"];
    expect(parseSvgPartIdList(ids)).toEqual(ids);
    expect(parseSvgPartIdList(ids)).not.toBe(ids);
  });
  it("preserves literal ids and supported color text", () => {
    expect(parseSvgPartIdList(' glyph.rect-0, tail"<node>, , ')).toEqual([
      "glyph.rect-0",
      'tail"<node>',
    ]);
    expect(resolveSvgSwatch(" #72dbe6 ")).toBe("#72dbe6");
    expect(resolveSvgSwatch("rgba(10, 20, 30, 0.5)")).toBe(
      "rgba(10, 20, 30, 0.5)",
    );
  });
  it.each([
    "url(https://example.invalid/asset)",
    "red; background:url(https://example.invalid/x)",
    "<img src=x onerror=alert(1)>",
  ])("does not turn paint text into external CSS: %s", (value) => {
    expect(resolveSvgSwatch(value)).toBe("#9aa5ae");
  });
});
