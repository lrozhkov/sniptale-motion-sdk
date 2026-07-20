import { describe, expect, it, vi } from "vitest";

import { installCanvasPropertyUpdatesOwner } from "../src/apps/viewer/canvas/property-updates";

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
    installCanvasPropertyUpdatesOwner(ctx);

    ctx.updateLayerProperty("box", "opacity", 0.8, {
      render: false,
      selection: false,
      timeline: false,
    });

    const track = ctx.timeline.tracks[0];
    expect(track.keyframes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ time: 1, value: 0.8 }),
      ]),
    );
    expect(ctx.override).toBeNull();
  });

  it("keeps a base edit as a base edit when the property has no track", () => {
    const ctx = createPropertyContext({ tracks: [] });
    installCanvasPropertyUpdatesOwner(ctx);

    ctx.updateLayerProperty("box", "opacity", 0.65, {
      render: false,
      selection: false,
      timeline: false,
    });

    expect(ctx.timeline.tracks).toEqual([]);
    expect(ctx.override.layers[0].opacity).toBe(0.65);
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
    installCanvasPropertyUpdatesOwner(ctx);

    ctx.updateLayerPropertyBatchAtTime(
      1,
      {
        box: { opacity: 0.7, x: 12 },
        title: { opacity: 0.5, y: 8 },
      },
      { render: false, selection: false, timeline: false },
    );

    expect(ctx.override.layers).toEqual([
      expect.objectContaining({ id: "box", opacity: 0.7, x: 0 }),
      expect.objectContaining({ id: "title", opacity: 0.5, y: 8 }),
    ]);
    expect(ctx.timeline.tracks[0].keyframes).toEqual(
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
    installCanvasPropertyUpdatesOwner(ctx);

    ctx.nudgeSelectedLayer(3, -2);

    expect(ctx.pausePlayback).toHaveBeenCalledWith({
      preservePreparation: true,
      renderCurrentFrame: false,
    });
    expect(ctx.commitHistory).toHaveBeenCalledWith("nudge-layer:box", {
      coalesceKey: "nudge-layer:box",
    });
    expect(ctx.timeline.tracks[0].keyframes).toEqual(
      expect.arrayContaining([expect.objectContaining({ time: 1, value: 13 })]),
    );
    expect(ctx.timeline.tracks[1].keyframes).toEqual(
      expect.arrayContaining([expect.objectContaining({ time: 1, value: 18 })]),
    );
  });
});

function createPropertyContext(
  timeline,
  sourceLayers: any[] = [{ id: "box", opacity: 1, type: "rect" }],
): any {
  const template = {
    duration: 3,
    id: "template",
    layers: sourceLayers,
  };
  const ctx: any = {
    deps: {
      clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
      deepClone: structuredClone,
      normalizeTimeline: (value) => value,
    },
    findPhaseIdAtTime: () => null,
    findSceneIdAtTime: () => null,
    canTransformLayerProperty: () => true,
    commitHistory: vi.fn(),
    getEffectiveDuration: () => template.duration,
    getEffectiveTemplate: () => ({
      ...template,
      layers: ctx.override?.layers ?? template.layers,
    }),
    getEffectiveTimeline: () => ctx.timeline,
    isLayerCanvasSelectable: () => true,
    override: null,
    refs: { timeSlider: { value: "1" } },
    pausePlayback: vi.fn(() => {
      ctx.state.playing = false;
    }),
    renderCurrentFrame: vi.fn(),
    renderInspector: vi.fn(),
    renderTimelineEditor: vi.fn(),
    setEditorOverride: vi.fn((value) => {
      ctx.override = value;
    }),
    snapTime: (value) => value,
    state: {
      currentTemplate: template,
      playing: false,
      timelineOverrides: new Map(),
    },
    timeline: structuredClone(timeline),
    toTitleLabel: (value) => value,
    updateCanvasSelectionBox: vi.fn(),
  };
  return ctx;
}
