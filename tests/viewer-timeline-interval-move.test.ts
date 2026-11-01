import { afterEach, describe, expect, it, vi } from "vitest";

import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import { requiredEntry } from "./helpers/required-entry.js";
import { readEditorTimeline } from "../src/apps/viewer/editor/timeline-source.js";
import type { EditorTemplate } from "../src/apps/viewer/templates/model.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("viewer timeline layer interval move contract", () => {
  it("moves a layer clip with owned keyframes and clamps to its scene", () => {
    const ctx = createClipMoveContext();
    const template: EditorTemplate = {
      layers: [
        { id: "title", type: "text" },
        { id: "logo", type: "rect" },
      ],
      clips: [{ duration: 2, layerId: "title", sceneId: "main", start: 1 }],
      duration: 4,
      id: "interval-contract",
      scenes: [{ duration: 4, id: "main", start: 0 }],
      timeline: {
        duration: 4,
        phases: [
          { duration: 1.1, id: "title-in", sceneId: "main", start: 1.2 },
        ],
        tracks: [
          {
            id: "title.opacity",
            layerId: "title",
            property: "opacity",
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

    ctx.state.currentTemplate = template;
    const plan = ctx.createClipMovePlan(template, ["title"], 4, true);

    expect(plan.maxDelta).toBe(1);
    ctx.applyClipMovePlan(template, plan, plan.maxDelta);

    expect(ctx.getEditorOverride(template).clips).toEqual([
      { duration: 2, layerId: "title", sceneId: "main", start: 2 },
    ]);
    const timelineOverride = readEditorTimeline(
      ctx.state.timelineOverrides.get(template.id),
      4,
    );
    expect(timelineOverride.phases).toEqual([
      expect.objectContaining({ id: "title-in", start: 2.2 }),
    ]);
    expect(
      requiredEntry(timelineOverride.tracks, 0).keyframes.map((keyframe) => ({
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
    const template: EditorTemplate = {
      layers: [
        { id: "title", type: "text" },
        { id: "logo", type: "rect" },
      ],
      clips: [
        { duration: 2, layerId: "title", sceneId: "main", start: 1 },
        { duration: 2, layerId: "logo", sceneId: "main", start: 1 },
      ],
      duration: 4,
      id: "shared-phase-contract",
      scenes: [{ duration: 4, id: "main", start: 0 }],
      timeline: {
        duration: 4,
        phases: [
          { duration: 1, id: "shared-reveal", sceneId: "main", start: 1 },
        ],
        tracks: [
          {
            id: "title.opacity",
            layerId: "title",
            property: "opacity",
            keyframes: [
              { id: "title-a", value: 0, phaseId: "shared-reveal", time: 1.1 },
              { id: "title-b", value: 1, phaseId: "shared-reveal", time: 1.8 },
            ],
            phaseId: "shared-reveal",
            target: "title",
          },
          {
            id: "logo.scale",
            layerId: "logo",
            property: "scaleX",
            keyframes: [
              { id: "logo-a", value: 0, phaseId: "shared-reveal", time: 1.2 },
              { id: "logo-b", value: 1, phaseId: "shared-reveal", time: 1.9 },
            ],
            phaseId: "shared-reveal",
            target: "logo",
          },
        ],
      },
    };

    ctx.state.currentTemplate = template;
    const plan = ctx.createClipMovePlan(template, ["title"], 4, true);

    expect(plan.phaseItems).toEqual([]);
    ctx.applyClipMovePlan(template, plan, 0.4);

    expect(ctx.getEditorOverride(template).clips).toEqual([
      { duration: 2, layerId: "title", sceneId: "main", start: 1.4 },
      { duration: 2, layerId: "logo", sceneId: "main", start: 1 },
    ]);
    const timelineOverride = readEditorTimeline(
      ctx.state.timelineOverrides.get(template.id),
      4,
    );
    expect(timelineOverride.phases).toEqual([
      expect.objectContaining({ id: "shared-reveal", start: 1 }),
    ]);
    expect(
      timelineOverride.tracks.map((track) => ({
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
  const ctx = createViewerContextFixture();
  ctx.refs.fpsInput.value = "30";
  ctx.refs.timeSlider.value = "0";
  vi.spyOn(ctx, "renderCurrentFrame").mockResolvedValue(undefined);
  vi.spyOn(ctx, "renderTimelineEditor").mockImplementation(() => {});
  return ctx;
}
