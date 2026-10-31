import { describe, expect, it } from "vitest";

import { clamp } from "../src/sdk/protocol";
import { deepClone, normalizeTimeline } from "../src/apps/viewer/editor/model";
import { createClipMoveActions } from "../src/apps/viewer/timeline/model/clip-move-plans";

describe("viewer timeline layer interval move contract", () => {
  it("moves a layer clip with owned keyframes and clamps to its scene", () => {
    const ctx = createClipMoveContext();
    const template = {
      clips: [{ duration: 2, layerId: "title", sceneId: "main", start: 1 }],
      duration: 4,
      id: "interval-contract",
      scenes: [{ duration: 4, id: "main", start: 0 }],
      timeline: {
        phases: [
          { duration: 1.1, id: "title-in", sceneId: "main", start: 1.2 },
        ],
        tracks: [
          {
            id: "title.opacity",
            keyframes: [
              { id: "title-a", phaseId: "title-in", time: 1.2, value: 0 },
              { id: "title-b", phaseId: "title-in", time: 2.3, value: 1 },
            ],
            phaseId: "title-in",
            target: "title",
          },
        ],
      },
    };

    const plan = ctx.createClipMovePlan(template, ["title"], 4, true);

    expect(plan.maxDelta).toBe(1);
    ctx.applyClipMovePlan(template, plan, plan.maxDelta);

    expect(ctx.editorOverride.clips).toEqual([
      { duration: 2, layerId: "title", sceneId: "main", start: 2 },
    ]);
    expect(ctx.timelineOverride.phases).toEqual([
      expect.objectContaining({ id: "title-in", start: 2.2 }),
    ]);
    expect(
      ctx.timelineOverride.tracks[0].keyframes.map((keyframe) => ({
        id: keyframe.id,
        time: keyframe.time,
      })),
    ).toEqual([
      { id: "title-a", time: 2.2 },
      { id: "title-b", time: 3.3 },
    ]);
  });

  it("moves only the selected layer keyframes for shared phases", () => {
    const ctx = createClipMoveContext();
    const template = {
      clips: [
        { duration: 2, layerId: "title", sceneId: "main", start: 1 },
        { duration: 2, layerId: "logo", sceneId: "main", start: 1 },
      ],
      duration: 4,
      id: "shared-phase-contract",
      scenes: [{ duration: 4, id: "main", start: 0 }],
      timeline: {
        phases: [
          { duration: 1, id: "shared-reveal", sceneId: "main", start: 1 },
        ],
        tracks: [
          {
            id: "title.opacity",
            keyframes: [
              { id: "title-a", phaseId: "shared-reveal", time: 1.1 },
              { id: "title-b", phaseId: "shared-reveal", time: 1.8 },
            ],
            phaseId: "shared-reveal",
            target: "title",
          },
          {
            id: "logo.scale",
            keyframes: [
              { id: "logo-a", phaseId: "shared-reveal", time: 1.2 },
              { id: "logo-b", phaseId: "shared-reveal", time: 1.9 },
            ],
            phaseId: "shared-reveal",
            target: "logo",
          },
        ],
      },
    };

    const plan = ctx.createClipMovePlan(template, ["title"], 4, true);

    expect(plan.phaseItems).toEqual([]);
    ctx.applyClipMovePlan(template, plan, 0.4);

    expect(ctx.editorOverride.clips).toEqual([
      { duration: 2, layerId: "title", sceneId: "main", start: 1.4 },
      { duration: 2, layerId: "logo", sceneId: "main", start: 1 },
    ]);
    expect(ctx.timelineOverride.phases).toEqual([
      expect.objectContaining({ id: "shared-reveal", start: 1 }),
    ]);
    expect(
      ctx.timelineOverride.tracks.map((track) => ({
        id: track.id,
        times: track.keyframes.map((keyframe) => keyframe.time),
      })),
    ).toEqual([
      { id: "title.opacity", times: [1.5, 2.2] },
      { id: "logo.scale", times: [1.2, 1.9] },
    ]);
  });
});

function createClipMoveContext() {
  const ctx: any = {
    deps: {
      clamp,
      deepClone,
      normalizeTimeline,
    },
    editorOverride: null,
    getEffectiveDuration: (template: any) => template.duration,
    getKeyframeOwnershipSceneId: (timeline: any, track: any, keyframe: any) => {
      if (typeof keyframe?.sceneId === "string") {
        return keyframe.sceneId;
      }
      if (typeof track?.sceneId === "string") {
        return track.sceneId;
      }
      const phaseId = keyframe?.phaseId ?? track?.phaseId;
      return timeline.phases?.find((phase: any) => phase.id === phaseId)
        ?.sceneId;
    },
    getTrackLayerId: (track: any) =>
      track.layerId ?? (track.target === "scene" ? null : track.target),
    isTimeInsideRange: (time: number, start: number, end: number) =>
      time >= start - 0.0001 && time <= end + 0.0001,
    renderCurrentFrame: () => undefined,
    renderTimelineEditor: () => undefined,
    setEditorOverride(update: any) {
      ctx.editorOverride = update;
    },
    snapDuration: (value: number) => value,
    snapTime: (value: number) => Math.round(value * 1000) / 1000,
    state: {
      timelineOverrides: new Map<string, any>(),
    },
  };
  Object.defineProperty(ctx, "timelineOverride", {
    get() {
      return ctx.state.timelineOverrides.get(
        ctx.lastTemplateId ?? "interval-contract",
      );
    },
  });
  const originalSet = ctx.state.timelineOverrides.set.bind(
    ctx.state.timelineOverrides,
  );
  ctx.state.timelineOverrides.set = (key: string, value: any) => {
    ctx.lastTemplateId = key;
    return originalSet(key, value);
  };
  Object.assign(
    ctx,
    createClipMoveActions(() => ctx),
  );
  return ctx;
}
