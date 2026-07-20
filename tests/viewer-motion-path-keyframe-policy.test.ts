import { describe, expect, it } from "vitest";
import {
  getTimelineMotionPath,
  syncMotionPathPositionKeyframes,
} from "../src/apps/viewer/canvas/motion-path-keyframe-policy";

describe("motion path keyframe policy", () => {
  it("inserts a newly keyed position into the canonical spatial path", () => {
    const timeline: any = {
      motionPaths: [
        {
          layerId: "box",
          points: [createPoint("x-a", "y-a"), createPoint("x-c", "y-c")],
        },
      ],
      tracks: [
        {
          id: "box.x",
          keyframes: [
            { easing: "linear", id: "x-a", time: 0, value: 0 },
            { easing: "out", id: "x-b", time: 1, value: 10 },
            { easing: "linear", id: "x-c", time: 2, value: 20 },
          ],
          layerId: "box",
          property: "x",
        },
        {
          id: "box.y",
          keyframes: [
            { easing: "linear", id: "y-a", time: 0, value: 0 },
            { easing: "linear", id: "y-b", time: 1, value: 5 },
            { easing: "linear", id: "y-c", time: 2, value: 10 },
          ],
          layerId: "box",
          property: "y",
        },
      ],
    };
    const path = getTimelineMotionPath(timeline, "box")!;

    syncMotionPathPositionKeyframes(
      timeline,
      path,
      timeline.tracks[0].keyframes[1],
      timeline.tracks[1].keyframes[1],
    );

    expect(path.points.map((point) => point.xKeyframeId)).toEqual([
      "x-a",
      "x-b",
      "x-c",
    ]);
    expect(timeline.tracks[1].keyframes[1].easing).toBe("out");
  });
});

function createPoint(xKeyframeId: string, yKeyframeId: string) {
  return {
    inTangent: { x: 0, y: 0 },
    kind: "linear" as const,
    outTangent: { x: 0, y: 0 },
    xKeyframeId,
    yKeyframeId,
  };
}
