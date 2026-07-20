import { describe, expect, it } from "vitest";

import {
  createKeyframeAlignPlan,
  createKeyframeDistributePlan,
  createKeyframeMovePlan,
  createKeyframeQuantizePlan,
  createKeyframeScalePlan,
  createKeyframeTimeSnapshot,
} from "../src/apps/viewer/timeline/model/keyframe-transform";

describe("viewer keyframe time transforms", () => {
  it("moves the immutable selection with one clamped delta", () => {
    const timeline = {
      tracks: [
        { id: "opacity", keyframes: [{ id: "a", time: 1 }] },
        { id: "scale", keyframes: [{ id: "x", time: 2 }] },
      ],
    };
    const snapshot = createKeyframeTimeSnapshot(
      timeline,
      [
        { keyframeId: "a", trackId: "opacity" },
        { keyframeId: "x", trackId: "scale" },
      ],
      4,
      1 / 30,
    );

    expect(createKeyframeMovePlan(snapshot, 10)).toEqual({
      ok: true,
      updates: {
        "opacity:a": 3,
        "scale:x": 4,
      },
    });
    expect(snapshot.entries.map((entry) => entry.time)).toEqual([1, 2]);
  });

  it("scales and distributes without cumulative drift", () => {
    const timeline = createTimeline();
    timeline.tracks[1].keyframes[0].time = 2.5;
    const snapshot = createKeyframeTimeSnapshot(
      timeline,
      [
        { keyframeId: "a", trackId: "opacity" },
        { keyframeId: "b", trackId: "opacity" },
        { keyframeId: "x", trackId: "scale" },
      ],
      4,
      1 / 30,
    );

    expect(createKeyframeScalePlan(snapshot, 0.5, "start")).toEqual({
      ok: true,
      updates: {
        "opacity:a": 1,
        "opacity:b": 2,
        "scale:x": 1.75,
      },
    });
    expect(createKeyframeDistributePlan(snapshot)).toEqual({
      ok: true,
      updates: {
        "opacity:a": 1,
        "opacity:b": 3,
        "scale:x": 2,
      },
    });
  });

  it("rejects collisions instead of applying a partial operation", () => {
    const sameTrack = createSnapshot([
      { keyframeId: "a", trackId: "opacity" },
      { keyframeId: "b", trackId: "opacity" },
    ]);
    expect(createKeyframeAlignPlan(sameTrack, 2)).toEqual({
      ok: false,
      reason: "collision",
    });

    const unselectedCollision = createSnapshot([
      { keyframeId: "a", trackId: "opacity" },
    ]);
    expect(createKeyframeMovePlan(unselectedCollision, 3)).toEqual({
      ok: false,
      reason: "collision",
    });
  });

  it("quantizes through one supplied frame policy", () => {
    const timeline = createTimeline();
    timeline.tracks[0].keyframes[0].time = 1.017;
    const snapshot = createKeyframeTimeSnapshot(
      timeline,
      [{ keyframeId: "a", trackId: "opacity" }],
      4,
      1 / 30,
    );
    expect(
      createKeyframeQuantizePlan(
        snapshot,
        (time) => Math.round(time * 30) / 30,
      ),
    ).toEqual({
      ok: true,
      updates: { "opacity:a": 31 / 30 },
    });
  });
});

function createSnapshot(refs) {
  return createKeyframeTimeSnapshot(createTimeline(), refs, 4, 1 / 30);
}

function createTimeline() {
  return {
    tracks: [
      {
        id: "opacity",
        keyframes: [
          { id: "a", time: 1 },
          { id: "b", time: 3 },
          { id: "c", time: 4 },
        ],
      },
      {
        id: "scale",
        keyframes: [{ id: "x", time: 2 }],
      },
    ],
  };
}
