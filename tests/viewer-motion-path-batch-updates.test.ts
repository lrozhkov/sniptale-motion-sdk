import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import { requiredEntry } from "./helpers/required-entry.js";
import { readEditorTimeline } from "../src/apps/viewer/editor/timeline-source.js";
import type { EditorTimeline } from "../src/apps/viewer/editor/model-types.js";
import type {
  MotionPathTrack,
  TimelineMotionPath,
} from "../src/shared/timeline/motion-path.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { updateCanvasMotionPathPointPositions } from "../src/apps/viewer/canvas/motion-path-batch-updates";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

    expect(ctx.normalizeTimeline).toHaveBeenCalledTimes(1);
    const timeline = ctx.state.timelineOverrides.get("fixture");
    expect(readKeyframe(timeline, "alpha.x", "alpha-x-a").value).toBe(12);
    expect(readKeyframe(timeline, "alpha.y", "alpha-y-a").value).toBe(18);
    expect(readKeyframe(timeline, "beta.x", "beta-x-a").value).toBe(-22);
    expect(readKeyframe(timeline, "beta.y", "beta-y-a").value).toBe(31);
  });

  it("does not merge spatial updates whose delimiter-joined identities collide", () => {
    const ctx = createContext();
    const timeline = createTimeline();
    requiredEntry(timeline.motionPaths, 0).points = [
      {
        ...requiredEntry(requiredEntry(timeline.motionPaths, 0).points, 0),
        xKeyframeId: "a:b",
        yKeyframeId: "c",
      },
      {
        ...requiredEntry(requiredEntry(timeline.motionPaths, 0).points, 0),
        xKeyframeId: "a",
        yKeyframeId: "b:c",
      },
    ];
    requiredEntry(timeline.tracks, 0).keyframes = [
      { id: "a:b", time: 0, value: 1 },
      { id: "a", time: 1, value: 2 },
    ];
    requiredEntry(timeline.tracks, 1).keyframes = [
      { id: "c", time: 0, value: 3 },
      { id: "b:c", time: 1, value: 4 },
    ];
    ctx.getEffectiveTimeline = () => structuredClone(timeline);
    expect(
      updateCanvasMotionPathPointPositions(
        ctx,
        [
          createUpdate("alpha", "a:b", "c", 10, 20),
          createUpdate("alpha", "a", "b:c", 30, 40),
        ],
        { inspector: false, render: false, selection: false, timeline: false },
      ),
    ).toBe(true);
    const result = ctx.state.timelineOverrides.get("fixture");
    expect(readKeyframe(result, "alpha.x", "a:b").value).toBe(10);
    expect(readKeyframe(result, "alpha.y", "c").value).toBe(20);
    expect(readKeyframe(result, "alpha.x", "a").value).toBe(30);
    expect(readKeyframe(result, "alpha.y", "b:c").value).toBe(40);
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

function createContext(options: { lockedLayerId?: string } = {}) {
  const ctx = createViewerContextFixture();
  const timeline = createTimeline();
  ctx.state.currentTemplate = {
    duration: 3,
    id: "fixture",
    layers: ["alpha", "beta"].map((id) => ({
      id,
      locked: options.lockedLayerId === id,
      type: "rect",
    })),
    timeline,
  };
  ctx.deps.t = (_key: string, fallback?: string) =>
    fallback === "Unlock the layer before editing its motion path."
      ? "locked"
      : (fallback ?? _key);
  const normalizeTimeline = vi.spyOn(ctx.deps, "normalizeTimeline");
  const logDiagnostic = vi
    .spyOn(ctx, "logDiagnostic")
    .mockImplementation(() => {});
  vi.spyOn(ctx, "renderCurrentFrame").mockResolvedValue(undefined);
  for (const key of [
    "renderInspector",
    "renderTimelineEditor",
    "renderTimelineModel",
    "updateCanvasSelectionBox",
  ] as const)
    vi.spyOn(ctx, key).mockImplementation(() => {});
  vi.spyOn(ctx, "canTransformLayerProperty").mockReturnValue(true);
  vi.spyOn(ctx, "isLayerActiveAtTime").mockReturnValue(true);
  return Object.assign(ctx, { normalizeTimeline, logDiagnostic });
}

function createTimeline() {
  return {
    duration: 3,
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

function createPath(
  layerId: string,
  xKeyframeId: string,
  yKeyframeId: string,
): TimelineMotionPath {
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

function createTrack(
  layerId: string,
  property: string,
  keyframeId: string,
  value: number,
): MotionPathTrack {
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

function createUpdate(
  layerId: string,
  xKeyframeId: string,
  yKeyframeId: string,
  x: number,
  y: number,
) {
  return {
    layerId,
    position: { x, y },
    xKeyframeId,
    yKeyframeId,
  };
}

function readKeyframe(value: unknown, trackId: string, keyframeId: string) {
  const timeline: EditorTimeline = readEditorTimeline(value, 3);
  const track = timeline.tracks.find((entry) => entry.id === trackId);
  const keyframe = track?.keyframes.find((entry) => entry.id === keyframeId);
  if (!keyframe)
    throw new Error(`Missing fixture keyframe ${trackId}/${keyframeId}`);
  return keyframe;
}
