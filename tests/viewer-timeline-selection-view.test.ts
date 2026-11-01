import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { syncTimelineSelection } from "../src/apps/viewer/timeline/view/selection";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("viewer timeline selection view", () => {
  it("updates selection affordances without rebuilding structural surfaces", () => {
    const ctx = createViewerContextFixture();
    installSelectionDomFixture();
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
    ctx.refs.timelineTracks = timelineTracks;
    ctx.refs.layersPanel = createRoot(
      new Map([[".layer-row[data-layer-id]", [layerPanelRow]]]),
    );
    ctx.state.currentTemplate = { id: "composition", duration: 2 };
    ctx.state.selectedItem = { layerId: "logo", type: "layer" };
    ctx.state.selectedLayers = ["logo"];
    vi.spyOn(ctx, "getEffectiveTimeline").mockReturnValue({
      duration: 2,
      phases: [],
      tracks: [],
    });
    const reconcileTimelineSelection = vi
      .spyOn(ctx, "reconcileTimelineSelection")
      .mockImplementation(() => {});
    vi.spyOn(ctx, "renderCurveEditor").mockImplementation(() => {});
    const renderInspector = vi
      .spyOn(ctx, "renderInspector")
      .mockImplementation(() => {});
    const renderSelectionCrumb = vi
      .spyOn(ctx, "renderSelectionCrumb")
      .mockImplementation(() => {});
    const updateCanvasSelectionBox = vi
      .spyOn(ctx, "updateCanvasSelectionBox")
      .mockImplementation(() => {});

    syncTimelineSelection(ctx);

    expect(selectedLayer.classList.contains("selected-layer")).toBe(true);
    expect(otherLayer.classList.contains("selected-layer")).toBe(false);
    expect(selectedClip.classList.contains("selected")).toBe(false);
    expect(layerPanelRow.classList.contains("selected")).toBe(true);
    expect(segment.remove).toHaveBeenCalledOnce();
    expect(reconcileTimelineSelection).toHaveBeenCalledOnce();
    expect(renderSelectionCrumb).toHaveBeenCalledOnce();
    expect(renderInspector).toHaveBeenCalledOnce();
    expect(updateCanvasSelectionBox).toHaveBeenCalledOnce();
  });
});

function installSelectionDomFixture() {
  class SelectionElement {
    dataset: Record<string, string> = {};
    elements = new Map<string, HTMLElement[]>();
    classes = new Set<string>();
    classList = {
      contains: (token: string) => this.classes.has(token),
      toggle: (token: string, force?: boolean) => {
        const enabled = force ?? !this.classes.has(token);
        if (enabled) this.classes.add(token);
        else this.classes.delete(token);
        return enabled;
      },
    };
    remove(): void {}
    querySelectorAll(selector: string) {
      return this.elements.get(selector) ?? [];
    }
  }
  vi.stubGlobal("HTMLDivElement", SelectionElement);
}

function createElement(dataset: Record<string, string>) {
  const element = new HTMLDivElement();
  Object.assign(element.dataset, dataset);
  return Object.assign(element, { remove: vi.spyOn(element, "remove") });
}

function createRoot(elements: Map<string, HTMLElement[]>) {
  return Object.assign(new HTMLDivElement(), { elements });
}
