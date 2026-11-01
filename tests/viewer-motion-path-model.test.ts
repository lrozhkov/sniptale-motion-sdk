import { requiredEntry } from "./helpers/required-entry.js";
import type { EditorTimeline } from "../src/apps/viewer/editor/model-types.js";
import { describe, expect, it } from "vitest";
import {
  createCanvasMotionPathModel,
  findCanvasMotionPathPoint,
  getCanvasMotionPathPointRefs,
  isCanvasMotionPathPointSelected,
} from "../src/apps/viewer/canvas/motion-path-model";

describe("canvas motion path model", () => {
  it("adapts aligned legacy x/y tracks without changing their schema", () => {
    const timeline = createTimeline();
    const model = createCanvasMotionPathModel(timeline, "box");

    expect(model.ok).toBe(true);
    if (!model.ok)
      throw new Error(`Unexpected motion path failure: ${model.reason}`);
    expect(model.source).toBe("legacy");
    expect(model.points).toMatchObject([
      {
        kind: "linear",
        time: 0,
        x: 10,
        xKeyframeId: "x-a",
        y: 30,
        yKeyframeId: "y-a",
      },
      {
        kind: "linear",
        time: 1,
        x: 20,
        xKeyframeId: "x-b",
        y: 40,
        yKeyframeId: "y-b",
      },
    ]);
  });

  it("rejects legacy tracks whose spatial keys cannot be paired by time", () => {
    const timeline = createTimeline();
    requiredEntry(requiredEntry(timeline.tracks, 1).keyframes, 1).time = 1.5;

    expect(createCanvasMotionPathModel(timeline, "box")).toEqual({
      layerId: "box",
      ok: false,
      reason: "unpaired-keyframes",
    });
  });

  it("resolves configured spatial point kinds and canonical pair refs", () => {
    const timeline = createTimeline();
    timeline.motionPaths = [
      {
        layerId: "box",
        points: [
          {
            inTangent: { x: 0, y: 0 },
            kind: "smooth",
            outTangent: { x: 12, y: -8 },
            xKeyframeId: "x-a",
            yKeyframeId: "y-a",
          },
          {
            inTangent: { x: -12, y: 8 },
            kind: "corner",
            outTangent: { x: 0, y: 0 },
            xKeyframeId: "x-b",
            yKeyframeId: "y-b",
          },
        ],
      },
    ];
    const model = createCanvasMotionPathModel(timeline, "box");
    expect(model.ok).toBe(true);
    if (!model.ok)
      throw new Error(`Unexpected motion path failure: ${model.reason}`);
    const point = findCanvasMotionPathPoint(model, "x-a", "y-a");
    if (!point) throw new Error("Missing configured motion path point.");
    expect(point.kind).toBe("smooth");
    expect(getCanvasMotionPathPointRefs(model, point)).toEqual([
      { keyframeId: "x-a", trackId: "box.x" },
      { keyframeId: "y-a", trackId: "box.y" },
    ]);
    expect(
      isCanvasMotionPathPointSelected(
        point,
        [{ keyframeId: "y-a", trackId: "box.y" }],
        model.xTrack.id,
        model.yTrack.id,
      ),
    ).toBe(true);
  });
});

function createTimeline(): EditorTimeline {
  return {
    duration: 2,
    phases: [],
    tracks: [
      {
        id: "box.x",
        keyframes: [
          { easing: "linear", id: "x-a", time: 0, value: 10 },
          { easing: "linear", id: "x-b", time: 1, value: 20 },
        ],
        layerId: "box",
        property: "x",
      },
      {
        id: "box.y",
        keyframes: [
          { easing: "linear", id: "y-a", time: 0, value: 30 },
          { easing: "linear", id: "y-b", time: 1, value: 40 },
        ],
        layerId: "box",
        property: "y",
      },
    ],
  };
}
