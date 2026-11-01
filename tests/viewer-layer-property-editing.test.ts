import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import { requiredEntry } from "./helpers/required-entry.js";
import type { EffectLayer } from "../src/sdk/types.js";
import { readEditorTimeline } from "../src/apps/viewer/editor/timeline-source.js";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("viewer layer property editing", () => {
  it("writes inspector edits into an existing animation track at the playhead", () => {
    const ctx = createPropertyContext({
      tracks: [
        {
          id: "box.opacity",
          keyframes: [
            { id: "opacity-a", time: 0, value: 0 },
            { id: "opacity-b", time: 2, value: 1 },
          ],
          layerId: "box",
          property: "opacity",
          target: "box",
        },
      ],
    });

    ctx.updateLayerProperty("box", "opacity", 0.8, {
      render: false,
      selection: false,
      timeline: false,
    });

    const track = requiredEntry(ctx.getEffectiveTimeline().tracks, 0);
    expect(track.keyframes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ time: 1, value: 0.8 }),
      ]),
    );
    expect(ctx.state.editorOverrides.has("template")).toBe(false);
  });

  it("keeps a base edit as a base edit when the property has no track", () => {
    const ctx = createPropertyContext({ tracks: [] });

    ctx.updateLayerProperty("box", "opacity", 0.65, {
      render: false,
      selection: false,
      timeline: false,
    });

    expect(ctx.getEffectiveTimeline().tracks).toEqual([]);
    expect(requiredEntry(requireTemplate(ctx).layers, 0).opacity).toBe(0.65);
  });

  it("updates heterogeneous layers and their tracks in one batch", () => {
    const ctx = createPropertyContext(
      {
        tracks: [
          {
            id: "box.x",
            keyframes: [
              { id: "box-x-a", time: 0, value: 0 },
              { id: "box-x-b", time: 2, value: 20 },
            ],
            layerId: "box",
            property: "x",
            target: "box",
          },
        ],
      },
      [
        { id: "box", opacity: 1, type: "rect", x: 0 },
        { id: "title", opacity: 1, type: "text", y: 0 },
      ],
    );

    ctx.updateLayerPropertyBatchAtTime(
      1,
      {
        box: { opacity: 0.7, x: 12 },
        title: { opacity: 0.5, y: 8 },
      },
      { render: false, selection: false, timeline: false },
    );

    expect(requireTemplate(ctx).layers).toEqual([
      expect.objectContaining({ id: "box", opacity: 0.7, x: 0 }),
      expect.objectContaining({ id: "title", opacity: 0.5, y: 8 }),
    ]);
    expect(
      requiredEntry(ctx.getEffectiveTimeline().tracks, 0).keyframes,
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ time: 1, value: 12 })]),
    );
    expect(ctx.renderInspector).toHaveBeenCalledTimes(1);
    expect(ctx.setEditorOverride).toHaveBeenCalledTimes(1);
  });

  it("pauses playback and nudges at one fixed playhead time", () => {
    const ctx = createPropertyContext({
      tracks: [
        {
          id: "box.x",
          keyframes: [
            { id: "x-a", time: 0, value: 0 },
            { id: "x-b", time: 2, value: 20 },
          ],
          layerId: "box",
          property: "x",
          target: "box",
        },
        {
          id: "box.y",
          keyframes: [
            { id: "y-a", time: 0, value: 0 },
            { id: "y-b", time: 2, value: 40 },
          ],
          layerId: "box",
          property: "y",
          target: "box",
        },
      ],
    });
    ctx.state.playing = true;
    ctx.state.selectedItem = { layerId: "box", type: "layer" };

    ctx.nudgeSelectedLayer(3, -2);

    expect(ctx.pausePlayback).toHaveBeenCalledWith({
      preservePreparation: true,
      renderCurrentFrame: false,
    });
    expect(ctx.commitHistory).toHaveBeenCalledWith("nudge-layer:box", {
      coalesceKey: "nudge-layer:box",
    });
    expect(
      requiredEntry(ctx.getEffectiveTimeline().tracks, 0).keyframes,
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ time: 1, value: 13 })]),
    );
    expect(
      requiredEntry(ctx.getEffectiveTimeline().tracks, 1).keyframes,
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ time: 1, value: 18 })]),
    );
  });
});

function createPropertyContext(
  timeline: unknown,
  sourceLayers: EffectLayer[] = [{ id: "box", opacity: 1, type: "rect" }],
) {
  const ctx = createViewerContextFixture();
  ctx.state.currentTemplate = {
    duration: 3,
    id: "template",
    layers: sourceLayers,
    timeline: readEditorTimeline(timeline, 3),
  };
  ctx.refs.timeSlider.value = "1";
  vi.spyOn(ctx, "findPhaseIdAtTime").mockReturnValue(null);
  vi.spyOn(ctx, "findSceneIdAtTime").mockReturnValue(null);
  vi.spyOn(ctx, "canTransformLayerProperty").mockReturnValue(true);
  vi.spyOn(ctx, "isLayerCanvasSelectable").mockReturnValue(true);
  const commitHistory = vi.spyOn(ctx, "commitHistory").mockReturnValue(true);
  const pausePlayback = vi
    .spyOn(ctx, "pausePlayback")
    .mockImplementation(() => {
      const wasPlaying = ctx.state.playing;
      ctx.state.playing = false;
      return wasPlaying;
    });
  const renderInspector = vi
    .spyOn(ctx, "renderInspector")
    .mockImplementation(() => {});
  const setEditorOverride = vi.spyOn(ctx, "setEditorOverride");
  for (const key of [
    "renderTimelineEditor",
    "renderTimelineModel",
    "syncInspectorLayerPropertyState",
    "updateCanvasSelectionBox",
  ] as const)
    vi.spyOn(ctx, key).mockImplementation(() => {});
  vi.spyOn(ctx, "renderCurrentFrame").mockResolvedValue(undefined);
  vi.spyOn(ctx, "snapTime").mockImplementation((value) => value);
  return Object.assign(ctx, {
    commitHistory,
    pausePlayback,
    renderInspector,
    setEditorOverride,
  });
}

function requireTemplate(ctx: ReturnType<typeof createPropertyContext>) {
  const template = ctx.getEffectiveTemplate();
  if (!template) throw new Error("Missing property fixture template");
  return template;
}
