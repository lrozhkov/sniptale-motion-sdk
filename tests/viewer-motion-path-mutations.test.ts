import { keyframeRefKey } from "../src/apps/viewer/timeline/model/keyframe-reference";
import { describe, expect, it } from "vitest";
import {
  duplicateInsertedMotionPathPoints,
  expandMotionPathKeyframeSelection,
  getPairedMotionPathKeyframeRef,
  removeDeletedMotionPathPoints,
} from "../src/apps/viewer/timeline/model/motion-path-mutations";

describe("motion path keyframe mutations", () => {
  it("expands a time-edit selection to the paired coordinate key", () => {
    const timeline = createTimeline();

    expect(
      expandMotionPathKeyframeSelection(timeline, [
        { keyframeId: "x-a", trackId: "box.x" },
      ]),
    ).toEqual([
      { keyframeId: "x-a", trackId: "box.x" },
      { keyframeId: "y-a", trackId: "box.y" },
    ]);
  });

  it("keeps delimiter-colliding foreign references out of paired path mutations", () => {
    const timeline = createTimeline();
    timeline.tracks[0].id = "a:b";
    timeline.tracks[0].keyframes[0].id = "c";
    timeline.motionPaths[0].points[0].xKeyframeId = "c";
    const refs = [{ trackId: "a", keyframeId: "b:c" }];
    expect(expandMotionPathKeyframeSelection(timeline, refs)).toEqual(refs);
    expect(
      removeDeletedMotionPathPoints(
        timeline,
        new Set(refs.map(keyframeRefKey)),
      ),
    ).toEqual(timeline.motionPaths);
    expect(
      duplicateInsertedMotionPathPoints(timeline, [
        { trackId: "a", fromKeyframeId: "b:c", toKeyframeId: "x-copy" },
        { trackId: "box.y", fromKeyframeId: "y-a", toKeyframeId: "y-copy" },
      ]),
    ).toEqual(timeline.motionPaths);
  });

  it("finds the paired coordinate key in either direction", () => {
    const timeline = createTimeline();
    expect(getPairedMotionPathKeyframeRef(timeline, "box.y", "y-a")).toEqual({
      keyframeId: "x-a",
      trackId: "box.x",
    });
  });

  it("drops a spatial point when either coordinate key is deleted", () => {
    const timeline = createTimeline();
    timeline.motionPaths[0].points.push({
      ...structuredClone(timeline.motionPaths[0].points[1]),
      xKeyframeId: "x-c",
      yKeyframeId: "y-c",
    });
    timeline.tracks[0].keyframes.push({ id: "x-c", time: 2, value: 20 });
    timeline.tracks[1].keyframes.push({ id: "y-c", time: 2, value: 20 });

    expect(
      removeDeletedMotionPathPoints(
        timeline,
        new Set([keyframeRefKey({ trackId: "box.x", keyframeId: "x-b" })]),
      )[0].points.map((point) => point.xKeyframeId),
    ).toEqual(["x-a", "x-c"]);
  });

  it("duplicates spatial metadata only when both coordinate keys are inserted", () => {
    const timeline = createTimeline();
    timeline.tracks[0].keyframes.push({ id: "x-copy", time: 2, value: 20 });
    timeline.tracks[1].keyframes.push({ id: "y-copy", time: 2, value: 20 });

    const paths = duplicateInsertedMotionPathPoints(timeline, [
      {
        fromKeyframeId: "x-b",
        toKeyframeId: "x-copy",
        trackId: "box.x",
      },
      {
        fromKeyframeId: "y-b",
        toKeyframeId: "y-copy",
        trackId: "box.y",
      },
    ]);

    expect(paths[0].points.at(-1)).toMatchObject({
      kind: "smooth",
      xKeyframeId: "x-copy",
      yKeyframeId: "y-copy",
    });
  });
});

function createTimeline(): any {
  return {
    motionPaths: [
      {
        layerId: "box",
        points: [
          {
            inTangent: { x: 0, y: 0 },
            kind: "smooth",
            outTangent: { x: 10, y: 0 },
            xKeyframeId: "x-a",
            yKeyframeId: "y-a",
          },
          {
            inTangent: { x: -10, y: 0 },
            kind: "smooth",
            outTangent: { x: 0, y: 0 },
            xKeyframeId: "x-b",
            yKeyframeId: "y-b",
          },
        ],
      },
    ],
    tracks: [
      {
        id: "box.x",
        keyframes: [
          { id: "x-a", time: 0, value: 0 },
          { id: "x-b", time: 1, value: 10 },
        ],
        layerId: "box",
        property: "x",
      },
      {
        id: "box.y",
        keyframes: [
          { id: "y-a", time: 0, value: 0 },
          { id: "y-b", time: 1, value: 10 },
        ],
        layerId: "box",
        property: "y",
      },
    ],
  };
}
