import { describe, expect, it } from "vitest";

import {
  clamp,
  deterministicRandom,
  interpolateTimelineValue,
  resolveTimelineEase,
  segment,
} from "../src/apps/sandbox/runtime/math";

describe("sandbox runtime math", () => {
  it("keeps deterministic random stable for seeds", () => {
    expect(deterministicRandom("sniptale")).toBe(0.522721);
    expect(deterministicRandom(null)).toBe(0.986326);
  });

  it("normalizes segments and clamps values", () => {
    expect(clamp(12, 0, 10)).toBe(10);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(segment(15, 10, 20)).toBe(0.5);
    expect(segment(25, 10, 20)).toBe(1);
  });

  it("interpolates nested timeline values", () => {
    expect(
      interpolateTimelineValue(
        { opacity: 0, xy: [0, 10], label: "from" },
        { opacity: 1, xy: [10, 20], label: "to" },
        0.25,
      ),
    ).toEqual({ opacity: 0.25, xy: [2.5, 12.5], label: "from" });
  });

  it("resolves hold and bezier timeline easing", () => {
    expect(resolveTimelineEase({ easing: "hold" }, 0.5)).toBe(0);
    expect(resolveTimelineEase({ easing: "hold" }, 1)).toBe(1);
    expect(
      resolveTimelineEase(
        {
          easing: "bezier",
          handles: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
        },
        0.5,
      ),
    ).toBeGreaterThan(0.5);
  });
});
