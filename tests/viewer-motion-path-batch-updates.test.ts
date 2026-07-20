import { describe, expect, it, vi } from "vitest";
import { updateCanvasMotionPathPointPositions } from "../src/apps/viewer/canvas/motion-path-batch-updates";

describe("motion path batch updates", () => {
  it("updates multiple spatial points through one normalized override", () => {
    const ctx = createContext();

    expect(
      updateCanvasMotionPathPointPositions(
        ctx,
        [
          createUpdate("alpha", "alpha-x-a", "alpha-y-a", 12, 18),
          createUpdate("beta", "beta-x-a", "beta-y-a", -22, 31),
        ],
        { inspector: false, render: false, selection: false, timeline: false },
      ),
    ).toBe(true);

    expect(ctx.deps.normalizeTimeline).toHaveBeenCalledTimes(1);
    const timeline = ctx.state.timelineOverrides.get("fixture");
    expect(readKeyframe(timeline, "alpha.x", "alpha-x-a").value).toBe(12);
    expect(readKeyframe(timeline, "alpha.y", "alpha-y-a").value).toBe(18);
    expect(readKeyframe(timeline, "beta.x", "beta-x-a").value).toBe(-22);
    expect(readKeyframe(timeline, "beta.y", "beta-y-a").value).toBe(31);
  });

  it("blocks the complete batch before mutating when one point is locked", () => {
    const ctx = createContext({ lockedLayerId: "beta" });

    expect(
      updateCanvasMotionPathPointPositions(ctx, [
        createUpdate("alpha", "alpha-x-a", "alpha-y-a", 12, 18),
        createUpdate("beta", "beta-x-a", "beta-y-a", -22, 31),
      ]),
    ).toBe(false);

    expect(ctx.state.timelineOverrides.size).toBe(0);
    expect(ctx.deps.normalizeTimeline).not.toHaveBeenCalled();
    expect(ctx.logDiagnostic).toHaveBeenCalledWith("locked", "error");
  });
});

function createContext(options: { lockedLayerId?: string } = {}): any {
  const timeline = createTimeline();
  const template = {
    duration: 3,
    id: "fixture",
    layers: ["alpha", "beta"].map((id) => ({
      id,
      locked: options.lockedLayerId === id,
      type: "rect",
    })),
    timeline,
  };
  return {
    canTransformLayerProperty: () => true,
    deps: {
      normalizeTimeline: vi.fn((value) => value),
      t: (_key, fallback) =>
        fallback === "Unlock the layer before editing its motion path."
          ? "locked"
          : fallback,
    },
    getEffectiveDuration: () => 3,
    getEffectiveTemplate: () => template,
    getEffectiveTimeline: () => structuredClone(timeline),
    isLayerActiveAtTime: () => true,
    logDiagnostic: vi.fn(),
    renderCurrentFrame: vi.fn(),
    renderInspector: vi.fn(),
    renderTimelineEditor: vi.fn(),
    state: {
      currentTemplate: template,
      timelineOverrides: new Map(),
    },
    updateCanvasSelectionBox: vi.fn(),
  };
}

function createTimeline(): any {
  return {
    motionPaths: [
      createPath("alpha", "alpha-x-a", "alpha-y-a"),
      createPath("beta", "beta-x-a", "beta-y-a"),
    ],
    phases: [],
    tracks: [
      createTrack("alpha", "x", "alpha-x-a", 1),
      createTrack("alpha", "y", "alpha-y-a", 2),
      createTrack("beta", "x", "beta-x-a", 3),
      createTrack("beta", "y", "beta-y-a", 4),
    ],
  };
}

function createPath(layerId, xKeyframeId, yKeyframeId) {
  return {
    layerId,
    points: [
      {
        inTangent: { x: 0, y: 0 },
        kind: "linear",
        outTangent: { x: 0, y: 0 },
        xKeyframeId,
        yKeyframeId,
      },
    ],
  };
}

function createTrack(layerId, property, keyframeId, value) {
  return {
    id: `${layerId}.${property}`,
    keyframes: [
      {
        easing: "linear",
        id: keyframeId,
        time: 0,
        value,
      },
    ],
    layerId,
    property,
  };
}

function createUpdate(layerId, xKeyframeId, yKeyframeId, x, y) {
  return {
    layerId,
    position: { x, y },
    xKeyframeId,
    yKeyframeId,
  };
}

function readKeyframe(timeline, trackId, keyframeId) {
  return timeline.tracks
    .find((track) => track.id === trackId)
    .keyframes.find((keyframe) => keyframe.id === keyframeId);
}
