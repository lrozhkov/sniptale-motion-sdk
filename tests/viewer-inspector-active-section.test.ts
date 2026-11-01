import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { appendLayerSelectionOverview } from "../src/apps/viewer/inspector/layer-overview";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("viewer inspector active section", () => {
  it("builds only the visible layer inspector section", () => {
    const ctx = createViewerContextFixture();
    const appendClipOwnershipEditor = vi
      .spyOn(ctx, "appendClipOwnershipEditor")
      .mockImplementation(() => {});
    const appendInspectorRows = vi
      .spyOn(ctx, "appendInspectorRows")
      .mockImplementation(() => {});
    const appendLayerPropertiesInspector = vi
      .spyOn(ctx, "appendLayerPropertiesInspector")
      .mockImplementation(() => {});
    vi.spyOn(ctx, "appendTimingOwnershipInspector").mockImplementation(
      () => {},
    );
    vi.spyOn(ctx, "isInspectorSectionActive").mockImplementation(
      (section) => section === "transform",
    );
    const setInspectorAppendSection = vi
      .spyOn(ctx, "setInspectorAppendSection")
      .mockImplementation(() => {});
    ctx.deps.t = (key, fallback) => fallback ?? key;
    const template = ctx.getEffectiveTemplate({
      id: "template",
      duration: 2,
      scenes: [],
      timeline: { duration: 2, phases: [], tracks: [] },
      clips: [{ duration: 2, layerId: "logo", start: 0 }],
      layers: [{ id: "logo", name: "Logo", type: "svgAsset" }],
    });
    if (!template)
      throw new Error("Missing effective inspector template fixture.");

    appendLayerSelectionOverview(
      ctx,
      { layerId: "logo", type: "layer" },
      template,
    );

    expect(setInspectorAppendSection).toHaveBeenCalledOnce();
    expect(setInspectorAppendSection).toHaveBeenCalledWith("transform");
    expect(appendLayerPropertiesInspector).toHaveBeenCalledOnce();
    expect(appendInspectorRows).not.toHaveBeenCalled();
    expect(appendClipOwnershipEditor).not.toHaveBeenCalled();
  });
});
