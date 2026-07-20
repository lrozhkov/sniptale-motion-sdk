import { describe, expect, it, vi } from "vitest";

import { appendLayerSelectionOverview } from "../src/apps/viewer/inspector/layer-overview";

describe("viewer inspector active section", () => {
  it("builds only the visible layer inspector section", () => {
    const ctx = {
      appendClipOwnershipEditor: vi.fn(),
      appendInspectorRows: vi.fn(),
      appendLayerPropertiesInspector: vi.fn(),
      appendTimingOwnershipInspector: vi.fn(),
      deps: { t: (_key, fallback) => fallback },
      getClipOwnershipSummary: vi.fn(),
      isInspectorSectionActive: (section) => section === "transform",
      setInspectorAppendSection: vi.fn(),
    } as any;
    const template = {
      clips: [{ duration: 2, layerId: "logo", start: 0 }],
      layers: [{ id: "logo", name: "Logo", type: "svgAsset" }],
    };

    appendLayerSelectionOverview(
      ctx,
      { layerId: "logo", type: "layer" },
      template,
    );

    expect(ctx.setInspectorAppendSection).toHaveBeenCalledOnce();
    expect(ctx.setInspectorAppendSection).toHaveBeenCalledWith("transform");
    expect(ctx.appendLayerPropertiesInspector).toHaveBeenCalledOnce();
    expect(ctx.appendInspectorRows).not.toHaveBeenCalled();
    expect(ctx.appendClipOwnershipEditor).not.toHaveBeenCalled();
  });
});
