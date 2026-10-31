import { evaluateTimelineKeyframes } from "../src/sdk/timeline/keyframe-value.js";
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

  it("interpolates reserved object keys as data without changing the result prototype", () => {
    const target: unknown = JSON.parse(
      '{"__proto__":{"marker":1},"constructor":2}',
    );
    const result: unknown = interpolateTimelineValue({}, target, 0.75);
    expect(result).toEqual(target);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(result, "__proto__")).toBe(
      true,
    );
  });

  it("uses the numeric fallback for omitted values inside a segment", () => {
    expect(
      evaluateTimelineKeyframes([{ time: 0 }, { time: 2, value: 20 }], 1, 10),
    ).toBe(15);
    expect(
      evaluateTimelineKeyframes([{ time: 0, value: 0 }, { time: 2 }], 1, 10),
    ).toBe(5);
    expect(evaluateTimelineKeyframes([{ time: 0 }, { time: 2 }], 1, 10)).toBe(
      10,
    );
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
