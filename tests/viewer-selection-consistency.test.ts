import { describe, expect, it } from "vitest";

import {
  getPrimaryKeyframeSelection,
  reconcileTimelineSelection,
} from "../src/apps/viewer/timeline/model/selection-consistency";

describe("viewer selection consistency", () => {
  it("reads the primary keyframe from the canonical selected collection", () => {
    expect(
      getPrimaryKeyframeSelection({
        selectedItem: { type: "effect" },
        selectedKeyframes: [{ keyframeId: "end", trackId: "opacity" }],
      }),
    ).toEqual({ keyframeId: "end", trackId: "opacity" });
  });

  it("validates restored selection against the effective editor template", () => {
    const baseTemplate = createTemplate();
    const effectiveTemplate = createTemplate({
      layers: [{ id: "added-in-editor" }],
    });
    const ctx = createContext(baseTemplate, effectiveTemplate);
    ctx.state.selectedItem = {
      layerId: "added-in-editor",
      type: "layer",
    };
    ctx.state.selectedLayers = ["added-in-editor"];

    reconcileTimelineSelection(ctx, baseTemplate);

    expect(ctx.state.selectedItem).toEqual({
      layerId: "added-in-editor",
      type: "layer",
    });
    expect(ctx.state.selectedLayers).toEqual(["added-in-editor"]);
  });

  it("drops stale and duplicate keyframes and derives a valid primary item", () => {
    const template = createTemplate({
      timeline: {
        phases: [],
        tracks: [
          {
            id: "opacity",
            keyframes: [{ id: "start" }, { id: "end" }],
          },
        ],
      },
    });
    const ctx = createContext(template);
    ctx.state.selectedItem = {
      keyframeId: "deleted",
      trackId: "opacity",
      type: "keyframe",
    };
    ctx.state.selectedKeyframes = [
      { keyframeId: "deleted", trackId: "opacity" },
      { keyframeId: "end", trackId: "opacity" },
      { keyframeId: "end", trackId: "opacity" },
      { keyframeId: "start", trackId: "missing-track" },
    ];

    reconcileTimelineSelection(ctx, template);

    expect(ctx.state.selectedKeyframes).toEqual([
      { keyframeId: "end", trackId: "opacity" },
    ]);
    expect(ctx.state.selectedItem).toEqual({
      keyframeId: "end",
      trackId: "opacity",
      type: "keyframe",
    });
    expect(getPrimaryKeyframeSelection(ctx.state)).toEqual({
      keyframeId: "end",
      trackId: "opacity",
    });
  });

  it("replaces a stale composition primary with the remaining interval", () => {
    const template = createTemplate({
      clips: [{ layerId: "card" }],
    });
    const ctx = createContext(template);
    ctx.state.selectedClips = ["card"];

    reconcileTimelineSelection(ctx, template);

    expect(ctx.state.selectedItem).toEqual({
      layerId: "card",
      type: "clip",
    });
  });

  it("keeps layer and clip collections mutually exclusive", () => {
    const template = createTemplate({
      clips: [{ layerId: "card" }],
      layers: [{ id: "card" }],
    });
    const ctx = createContext(template);
    ctx.state.selectedClips = ["card"];
    ctx.state.selectedItem = { layerId: "card", type: "layer" };
    ctx.state.selectedLayers = ["card"];

    reconcileTimelineSelection(ctx, template);

    expect(ctx.state.selectedLayers).toEqual(["card"]);
    expect(ctx.state.selectedClips).toEqual([]);
  });

  it("canonicalizes restored group and descendant selection", () => {
    const template = createTemplate({
      layers: [
        { id: "group-1", type: "group" },
        { id: "card", parentId: "group-1", type: "rect" },
      ],
    });
    const ctx = createContext(template);
    ctx.state.selectedItem = { layerId: "card", type: "layer" };
    ctx.state.selectedLayers = ["card", "group-1"];

    reconcileTimelineSelection(ctx, template);

    expect(ctx.state.selectedLayers).toEqual(["group-1"]);
    expect(ctx.state.selectedItem).toEqual({
      layerId: "group-1",
      type: "layer",
    });
  });

  it("clears timeline selection for assets and empty templates", () => {
    const template = createTemplate({
      clips: [{ layerId: "card" }],
      layers: [{ id: "card" }],
    });
    const ctx = createContext(template);
    ctx.state.assets.set("logo", { id: "logo" });
    ctx.state.selectedClips = ["card"];
    ctx.state.selectedItem = { assetId: "logo", type: "asset" };
    ctx.state.selectedLayers = ["card"];

    reconcileTimelineSelection(ctx, template);

    expect(ctx.state.selectedItem).toEqual({
      assetId: "logo",
      type: "asset",
    });
    expectTimelineSelectionToBeEmpty(ctx.state);

    ctx.getEffectiveTemplate = () => null;
    ctx.state.selectedItem = { layerId: "card", type: "layer" };
    ctx.state.selectedLayers = ["card"];
    reconcileTimelineSelection(ctx, null);

    expect(ctx.state.selectedItem).toEqual({ type: "effect" });
    expectTimelineSelectionToBeEmpty(ctx.state);
  });
});

function createTemplate(patch: Record<string, any> = {}) {
  return {
    clips: [],
    duration: 4,
    id: "composition",
    layers: [],
    scenes: [],
    timeline: { phases: [], tracks: [] },
    ...patch,
  };
}

function createContext(baseTemplate, effectiveTemplate = baseTemplate): any {
  return {
    getEffectiveTemplate: (template) => (template ? effectiveTemplate : null),
    normalizeScenes: (scenes) => scenes,
    state: {
      assets: new Map(),
      currentTemplate: baseTemplate,
      selectedClips: [],
      selectedItem: { type: "effect" },
      selectedKeyframes: [],
      selectedLayers: [],
      selectedPhases: [],
      selectedScenes: [],
    },
  };
}

function expectTimelineSelectionToBeEmpty(state): void {
  expect(state.selectedClips).toEqual([]);
  expect(state.selectedKeyframes).toEqual([]);
  expect(state.selectedLayers).toEqual([]);
  expect(state.selectedPhases).toEqual([]);
  expect(state.selectedScenes).toEqual([]);
}
