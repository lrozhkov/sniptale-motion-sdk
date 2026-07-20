import { describe, expect, it, vi } from "vitest";

import { syncTimelineSelection } from "../src/apps/viewer/timeline/view/selection";

describe("viewer timeline selection view", () => {
  it("updates selection affordances without rebuilding structural surfaces", () => {
    const selectedLayer = createElement({ layerId: "logo" });
    const otherLayer = createElement({ layerId: "background" });
    otherLayer.classList.toggle("selected-layer", true);
    const selectedClip = createElement({ layerId: "logo" });
    selectedClip.classList.toggle("selected", true);
    const layerPanelRow = createElement({ layerId: "logo" });
    const segment = createElement({});
    const timelineTracks = createRoot(
      new Map([
        [".layer-lane[data-layer-id]", [selectedLayer, otherLayer]],
        [".property-track-lane[data-track-id]", []],
        [".clip-block[data-layer-id]", [selectedClip]],
        [".phase-block[data-phase-id]", []],
        [".scene-block[data-scene-id]", []],
        [".keyframe-point[data-track-id][data-keyframe-id]", []],
        [".keyframe-segment-range", [segment]],
      ]),
    );
    const ctx = {
      isSelectedClip: () => false,
      isSelectedKeyframe: () => false,
      isSelectedLayer: (layerId) => layerId === "logo",
      isSelectedPhase: () => false,
      isSelectedScene: () => false,
      getEffectiveTimeline: () => ({ phases: [], tracks: [] }),
      refs: {
        layersPanel: createRoot(
          new Map([[".layer-row[data-layer-id]", [layerPanelRow]]]),
        ),
        timelineTracks,
      },
      reconcileTimelineSelection: vi.fn(),
      renderCurveEditor: vi.fn(),
      renderInspector: vi.fn(),
      renderSelectionCrumb: vi.fn(),
      state: {
        currentTemplate: { id: "composition" },
        selectedItem: { layerId: "logo", type: "layer" },
      },
      updateCanvasSelectionBox: vi.fn(),
    } as any;

    syncTimelineSelection(ctx);

    expect(selectedLayer.classList.contains("selected-layer")).toBe(true);
    expect(otherLayer.classList.contains("selected-layer")).toBe(false);
    expect(selectedClip.classList.contains("selected")).toBe(false);
    expect(layerPanelRow.classList.contains("selected")).toBe(true);
    expect(segment.remove).toHaveBeenCalledOnce();
    expect(ctx.reconcileTimelineSelection).toHaveBeenCalledOnce();
    expect(ctx.renderSelectionCrumb).toHaveBeenCalledOnce();
    expect(ctx.renderInspector).toHaveBeenCalledOnce();
    expect(ctx.updateCanvasSelectionBox).toHaveBeenCalledOnce();
  });
});

function createElement(dataset: Record<string, string>) {
  const classes = new Set<string>();
  return {
    classList: {
      contains: (className: string) => classes.has(className),
      toggle(className: string, enabled: boolean) {
        if (enabled) {
          classes.add(className);
        } else {
          classes.delete(className);
        }
      },
    },
    dataset,
    remove: vi.fn(),
  };
}

function createRoot(elements: Map<string, any[]>) {
  return {
    querySelectorAll(selector: string) {
      return elements.get(selector) ?? [];
    },
  };
}
