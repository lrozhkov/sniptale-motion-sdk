import { describe, expect, it } from "vitest";

import {
  isCompactCanvasSelection,
  resolveCanvasResizeCursor,
} from "../src/apps/viewer/canvas/transform-handles";

describe("viewer canvas transform handle affordances", () => {
  it("rotates resize cursors with the selected layer axes", () => {
    expect(resolveCanvasResizeCursor("e", 0)).toBe("ew-resize");
    expect(resolveCanvasResizeCursor("e", 45)).toBe("nwse-resize");
    expect(resolveCanvasResizeCursor("e", 90)).toBe("ns-resize");
    expect(resolveCanvasResizeCursor("e", 135)).toBe("nesw-resize");
    expect(resolveCanvasResizeCursor("e", 180)).toBe("ew-resize");
    expect(resolveCanvasResizeCursor("e", -45)).toBe("nesw-resize");
  });

  it("keeps opposite and corner handles on the same resize axis", () => {
    expect(resolveCanvasResizeCursor("n", 30)).toBe(
      resolveCanvasResizeCursor("s", 30),
    );
    expect(resolveCanvasResizeCursor("ne", 30)).toBe(
      resolveCanvasResizeCursor("sw", 30),
    );
    expect(resolveCanvasResizeCursor("nw", 30)).toBe(
      resolveCanvasResizeCursor("se", 30),
    );
  });

  it("uses a neutral cursor for an unknown handle", () => {
    expect(resolveCanvasResizeCursor("center", 45)).toBe("default");
  });

  it.each(
    ["__proto__", "constructor", ["e"], { toString: null }].map(
      (value: unknown) => ({ value }),
    ),
  )("rejects invalid handle keys: %j", ({ value }) => {
    expect(resolveCanvasResizeCursor(value, 0)).toBe("default");
  });
  it.each(
    ["45", [45], { toString: null }, Infinity, NaN].map((value: unknown) => ({
      value,
    })),
  )("uses the finite numeric rotation boundary: %j", ({ value }) => {
    expect(resolveCanvasResizeCursor("e", value)).toBe("ew-resize");
  });

  it("uses corner-only resize affordances when edge targets would overlap", () => {
    expect(isCompactCanvasSelection({ height: 50, width: 246 })).toBe(true);
    expect(isCompactCanvasSelection({ height: 80, width: 80 })).toBe(false);
    expect(isCompactCanvasSelection({ height: 0, width: 80 })).toBe(false);
  });
});
