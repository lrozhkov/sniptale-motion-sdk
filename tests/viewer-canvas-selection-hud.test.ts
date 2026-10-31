import { describe, expect, it } from "vitest";

import { resolveCanvasHudPosition } from "../src/apps/viewer/canvas/selection-hud-position";
import { formatCanvasHudNumber } from "../src/apps/viewer/canvas/selection-hud";

describe("viewer canvas selection HUD", () => {
  it("uses compact display precision without changing inspector values", () => {
    expect(formatCanvasHudNumber(-24.461)).toBe("-24.5");
    expect(formatCanvasHudNumber(507.624)).toBe("507.6");
    expect(formatCanvasHudNumber(-0.001)).toBe("0");
    expect(formatCanvasHudNumber(1e308)).toBe("1e+308");
  });

  it.each(
    [true, "12", [12], { toString: null }, Infinity, -Infinity].map(
      (value: unknown) => ({ value }),
    ),
  )("does not coerce invalid metric values: %j", ({ value }) => {
    expect(formatCanvasHudNumber(value)).toBe("0");
  });

  it("prefers the right side when the HUD fits", () => {
    expect(
      resolveCanvasHudPosition({
        hud: { height: 60, width: 240 },
        selection: { height: 100, left: 300, top: 180, width: 120 },
        stage: { height: 600, width: 1000 },
      }),
    ).toEqual({ left: 432, top: 180 });
  });

  it("moves to the left at the right edge", () => {
    expect(
      resolveCanvasHudPosition({
        hud: { height: 60, width: 240 },
        selection: { height: 100, left: 850, top: 180, width: 120 },
        stage: { height: 600, width: 1000 },
      }),
    ).toEqual({ left: 598, top: 180 });
  });

  it("uses the space above a selection near the bottom edge", () => {
    expect(
      resolveCanvasHudPosition({
        hud: { height: 60, width: 240 },
        selection: { height: 70, left: 0, top: 520, width: 1000 },
        stage: { height: 600, width: 1000 },
      }),
    ).toEqual({ left: 380, top: 448 });
  });

  it("clamps oversized edge cases inside the stage safe area", () => {
    const position = resolveCanvasHudPosition({
      hud: { height: 120, width: 500 },
      selection: { height: 580, left: -40, top: -20, width: 1080 },
      stage: { height: 600, width: 1000 },
    });

    expect(position.left).toBeGreaterThanOrEqual(8);
    expect(position.left + 500).toBeLessThanOrEqual(992);
    expect(position.top).toBeGreaterThanOrEqual(38);
    expect(position.top + 120).toBeLessThanOrEqual(592);
  });

  it("anchors renderer-managed selection status inside the canvas", () => {
    expect(
      resolveCanvasHudPosition({
        hud: { height: 54, width: 260 },
        placement: "managed",
        selection: { height: 720, left: 40, top: 24, width: 1280 },
        stage: { height: 800, width: 1400 },
      }),
    ).toEqual({ left: 52, top: 48 });
  });

  it("keeps renderer-managed status inside a narrow stage", () => {
    expect(
      resolveCanvasHudPosition({
        hud: { height: 54, width: 260 },
        placement: "managed",
        selection: { height: 320, left: 180, top: 80, width: 640 },
        stage: { height: 400, width: 300 },
      }),
    ).toEqual({ left: 32, top: 92 });
  });
});
