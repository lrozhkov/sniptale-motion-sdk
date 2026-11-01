import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import type {
  EditorTemplate,
  EditorTemplateSource,
} from "../src/apps/viewer/templates/model.js";
import type { ViewerAppContext } from "../src/apps/viewer/app/context.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getPrimaryKeyframeSelection,
  reconcileTimelineSelection,
} from "../src/apps/viewer/timeline/model/selection-consistency";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("viewer selection consistency", () => {
  it("does not coerce malformed primary identifiers", () => {
    expect(
      getPrimaryKeyframeSelection({
        selectedKeyframes: [{ trackId: { toString: 0 }, keyframeId: "a" }],
      }),
    ).toBeNull();
    const ctx = createContext(createTemplate());
    // Probe malformed persisted data before reconciliation validates the selection.
    expect(
      Reflect.set(ctx.state, "selectedItem", {
        type: "layer",
        layerId: { toString: 0 },
      }),
    ).toBe(true);
    reconcileTimelineSelection(ctx);
    expect(ctx.state.selectedItem).toEqual({ type: "effect" });
  });

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
      layers: [{ id: "added-in-editor", type: "rect" }],
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
      layers: [{ id: "card", type: "rect" }],
      timeline: {
        duration: 4,
        phases: [],
        tracks: [
          {
            id: "opacity",
            layerId: "card",
            property: "opacity",
            keyframes: [
              { id: "start", time: 0, value: 0 },
              { id: "end", time: 4, value: 1 },
            ],
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
      clips: [{ layerId: "card", start: 0, duration: 4 }],
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
      clips: [{ layerId: "card", start: 0, duration: 4 }],
      layers: [{ id: "card", type: "rect" }],
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
      clips: [{ layerId: "card", start: 0, duration: 4 }],
      layers: [{ id: "card", type: "rect" }],
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

function createTemplate(patch: Partial<EditorTemplate> = {}): EditorTemplate {
  return {
    clips: [],
    duration: 4,
    id: "composition",
    layers: [],
    scenes: [],
    timeline: { duration: 4, phases: [], tracks: [] },
    ...patch,
  };
}

function createContext(
  baseTemplate: EditorTemplateSource,
  effectiveTemplate: EditorTemplateSource = baseTemplate,
) {
  const ctx = createViewerContextFixture();
  ctx.state.currentTemplate = baseTemplate;
  ctx.refs.timeSlider.value = "0";
  const effective = ctx.getEffectiveTemplate(effectiveTemplate);
  if (!effective)
    throw new Error("Missing effective selection template fixture.");
  vi.spyOn(ctx, "getEffectiveTemplate").mockImplementation((source) =>
    source ? effective : null,
  );
  return ctx;
}

function expectTimelineSelectionToBeEmpty(
  state: ViewerAppContext["state"],
): void {
  expect(state.selectedClips).toEqual([]);
  expect(state.selectedKeyframes).toEqual([]);
  expect(state.selectedLayers).toEqual([]);
  expect(state.selectedPhases).toEqual([]);
  expect(state.selectedScenes).toEqual([]);
}
