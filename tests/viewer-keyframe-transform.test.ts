import { requiredEntry } from "./helpers/required-entry.js";
import { describe, expect, it } from "vitest";

import {
  createKeyframeAlignPlan,
  createKeyframeDistributePlan,
  createKeyframeMovePlan,
  createKeyframeQuantizePlan,
  createKeyframeScalePlan,
  createKeyframeTimeSnapshot,
  createKeyframeTimePlan,
} from "../src/apps/viewer/timeline/model/keyframe-transform";

describe("viewer keyframe time transforms", () => {
  it("keeps an unselected key with a delimiter-colliding identity in collision checks", () => {
    const snapshot = requireTimeSnapshot(
      {
        tracks: [
          { id: "a:b", keyframes: [{ id: "c", time: 0 }] },
          { id: "a", keyframes: [{ id: "b:c", time: 1 }] },
        ],
      },
      [{ trackId: "a:b", keyframeId: "c" }],
      4,
      1 / 30,
    );
    expect(snapshot.unselectedTimesByTrack.get("a")).toEqual([1]);
  });

  it("moves the immutable selection with one clamped delta", () => {
    const timeline = {
      tracks: [
        { id: "opacity", keyframes: [{ id: "a", time: 1 }] },
        { id: "scale", keyframes: [{ id: "x", time: 2 }] },
      ],
    };
    const snapshot = requireTimeSnapshot(
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
      updates: [
        { trackId: "opacity", keyframeId: "a", time: 3 },
        { trackId: "scale", keyframeId: "x", time: 4 },
      ],
    });
    expect(snapshot.entries.map((entry) => entry.time)).toEqual([1, 2]);
  });

  it("scales and distributes without cumulative drift", () => {
    const timeline = createTimeline();
    requiredEntry(requiredEntry(timeline.tracks, 1).keyframes, 0).time = 2.5;
    const snapshot = requireTimeSnapshot(
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
      updates: [
        { trackId: "opacity", keyframeId: "a", time: 1 },
        { trackId: "opacity", keyframeId: "b", time: 2 },
        { trackId: "scale", keyframeId: "x", time: 1.75 },
      ],
    });
    expect(createKeyframeDistributePlan(snapshot)).toEqual({
      ok: true,
      updates: [
        { trackId: "opacity", keyframeId: "a", time: 1 },
        { trackId: "opacity", keyframeId: "b", time: 3 },
        { trackId: "scale", keyframeId: "x", time: 2 },
      ],
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

  it("requires each selected reference exactly once and copies accepted input", () => {
    const snapshot = createSnapshot([
      { keyframeId: "a", trackId: "opacity" },
      { keyframeId: "x", trackId: "scale" },
    ]);
    const updates = snapshot.entries.map((entry) => ({
      ...entry,
      time: entry.time + 0.2,
    }));
    expect(createKeyframeTimePlan(snapshot, updates.slice(1))).toEqual({
      ok: false,
      reason: "out-of-range",
    });
    expect(
      createKeyframeTimePlan(snapshot, [
        ...updates,
        { trackId: "other", keyframeId: "a", time: 1 },
      ]),
    ).toEqual({ ok: false, reason: "out-of-range" });
    expect(
      createKeyframeTimePlan(
        snapshot,
        updates.map(() => ({ trackId: "opacity", keyframeId: "a", time: 2 })),
      ),
    ).toEqual({ ok: false, reason: "collision" });
    expect(
      createKeyframeTimePlan(
        snapshot,
        updates.map((entry) => ({ ...entry, trackId: "foreign" })),
      ),
    ).toEqual({ ok: false, reason: "out-of-range" });
    const plan = createKeyframeTimePlan(snapshot, updates);
    const first = updates[0];
    if (!first) throw new Error("Expected an update");
    first.time = 100;
    expect(plan).toEqual({
      ok: true,
      updates: [
        { trackId: "opacity", keyframeId: "a", time: 1.2 },
        { trackId: "scale", keyframeId: "x", time: 2.2 },
      ],
    });
  });

  it("quantizes through one supplied frame policy", () => {
    const timeline = createTimeline();
    requiredEntry(requiredEntry(timeline.tracks, 0).keyframes, 0).time = 1.017;
    const snapshot = requireTimeSnapshot(
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
      updates: [{ trackId: "opacity", keyframeId: "a", time: 31 / 30 }],
    });
  });
});

function createSnapshot(
  refs: Parameters<typeof createKeyframeTimeSnapshot>[1],
) {
  return requireTimeSnapshot(createTimeline(), refs, 4, 1 / 30);
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

function requireTimeSnapshot(
  ...args: Parameters<typeof createKeyframeTimeSnapshot>
) {
  const snapshot = createKeyframeTimeSnapshot(...args);
  if (!snapshot)
    throw new Error("Expected a valid keyframe time snapshot fixture");
  return snapshot;
}
