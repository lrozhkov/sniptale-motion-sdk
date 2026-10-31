import { describe, expect, it } from "vitest";
import {
  createCanvasMotionPathModel,
  type CanvasMotionPathTimeline,
} from "../src/apps/viewer/canvas/motion-path-model.js";
import {
  getDefaultLayerProperty,
  resolveNumericTrack,
} from "../src/apps/viewer/canvas/numeric-track.js";
import { clamp } from "../src/sdk/protocol.js";

const invalid = [
  true,
  null,
  "12",
  [],
  [12],
  { toString: null },
  NaN,
  Infinity,
].map((value: unknown) => ({ value }));
describe("canvas numeric receiving boundaries", () => {
  it.each(invalid)(
    "does not coerce position keyframe values: %j",
    ({ value }) => {
      const timeline: CanvasMotionPathTimeline = {
        tracks: [
          {
            id: "box.x",
            property: "x",
            layerId: "box",
            keyframes: [{ id: "x", time: 0, value }],
          },
          {
            id: "box.y",
            property: "y",
            layerId: "box",
            keyframes: [{ id: "y", time: 0, value: 10 }],
          },
        ],
      };
      expect(createCanvasMotionPathModel(timeline, "box").ok).toBe(false);
      expect(
        resolveNumericTrack(
          { deps: { clamp } },
          timeline.tracks?.[0],
          0,
          7,
          timeline,
        ),
      ).toBe(7);
    },
  );

  it.each(invalid)("does not coerce layer defaults: %j", ({ value }) => {
    expect(getDefaultLayerProperty({ x: value }, "x")).toBe(0);
    expect(getDefaultLayerProperty({ scaleX: value }, "scaleX")).toBe(1);
    expect(getDefaultLayerProperty({ opacity: value }, "opacity")).toBe(1);
  });

  it("preserves finite numeric zero rather than treating it as absence", () => {
    expect(getDefaultLayerProperty({ opacity: 0 }, "opacity")).toBe(0);
    expect(getDefaultLayerProperty({ scaleY: 0 }, "scaleY")).toBe(0);
    expect(getDefaultLayerProperty({ x: -12 }, "x")).toBe(-12);
  });
});
