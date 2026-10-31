import { afterEach, describe, expect, it, vi } from "vitest";
import {
  captureCompositionWorkspaceView,
  restoreCompositionWorkspaceView,
} from "../src/apps/viewer/templates/workspace-view-state";

describe("composition workspace view state", () => {
  afterEach(() => vi.unstubAllGlobals());
  for (const change of ["source", "generation", "stored-view"] as const) {
    it(`does not restore stale scroll state after ${change} changes`, () => {
      const ctx = createContext();
      const frames: FrameRequestCallback[] = [];
      vi.stubGlobal(
        "requestAnimationFrame",
        (callback: FrameRequestCallback) => {
          frames.push(callback);
          return frames.length;
        },
      );
      captureCompositionWorkspaceView(ctx);
      const source = ctx.state.currentTemplate;
      expect(restoreCompositionWorkspaceView(ctx, source)).toBe(true);
      ctx.refs.timelineTracks.scrollTop = 4;
      ctx.refs.stageWrap.scrollLeft = 5;
      ctx.refs.stageWrap.scrollTop = 6;
      if (change === "source") ctx.state.currentTemplate = { id: "beta" };
      if (change === "generation") ctx.state.templateSelectionGeneration += 1;
      if (change === "stored-view") captureCompositionWorkspaceView(ctx);
      frames[0]?.(0);
      expect(ctx.refs.timelineTracks.scrollTop).toBe(4);
      expect(ctx.refs.stageWrap.scrollLeft).toBe(5);
      expect(ctx.refs.stageWrap.scrollTop).toBe(6);
      expect(ctx.renderCanvasIsolationBreadcrumb).not.toHaveBeenCalled();
      expect(ctx.updateCanvasSelectionBox).not.toHaveBeenCalled();
    });
  }

  it("restores canvas, timeline, tree, graph, and isolation view per composition", () => {
    const ctx = createContext();
    const requestAnimationFrame = vi.fn((callback) => callback());
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);

    captureCompositionWorkspaceView(ctx);
    ctx.state.expandedSceneIds = new Set();
    ctx.state.expandedTimelineRowIds = new Set();
    ctx.state.timelineZoom = 1;
    ctx.state.timelineOffset = 0;
    ctx.state.graphEditorEnabled = false;
    ctx.state.graphEditorViewport = null;
    ctx.state.canvasIsolationGroupId = null;
    ctx.refs.timelineTracks.scrollTop = 0;
    ctx.refs.stageWrap.scrollLeft = 0;
    ctx.refs.stageWrap.scrollTop = 0;

    expect(
      restoreCompositionWorkspaceView(ctx, ctx.state.currentTemplate),
    ).toBe(true);
    expect(ctx.state.expandedSceneIds).toEqual(new Set(["main"]));
    expect(ctx.state.expandedTimelineRowIds).toEqual(
      new Set(["scene:main", "group:main:compose"]),
    );
    expect(ctx.state.timelineZoom).toBe(2.5);
    expect(ctx.state.timelineOffset).toBe(1.25);
    expect(ctx.refs.timelineZoomInput.value).toBe("2.5");
    expect(ctx.refs.timelineTracks.scrollTop).toBe(180);
    expect(ctx.refs.stageWrap.scrollLeft).toBe(210);
    expect(ctx.refs.stageWrap.scrollTop).toBe(90);
    expect(ctx.state.graphEditorEnabled).toBe(true);
    expect(ctx.state.graphEditorViewport).toEqual({ timeStart: 1 });
    expect(ctx.state.canvasIsolationGroupId).toBe("compose");
    expect(ctx.setPreviewZoom).toHaveBeenCalledWith("100");
    expect(ctx.renderCanvasIsolationBreadcrumb).toHaveBeenCalled();
    expect(ctx.updateCanvasSelectionBox).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("uses a clean fitted viewport for an unseen composition", () => {
    const ctx = createContext();
    ctx.state.compositionWorkspaceViews.clear();

    expect(
      restoreCompositionWorkspaceView(ctx, ctx.state.currentTemplate),
    ).toBe(false);
    expect(ctx.setPreviewZoom).toHaveBeenCalledWith("fit");
    expect(ctx.refs.timelineZoomInput.value).toBe("1");
  });
});

function createContext(): any {
  const currentTemplate = { id: "alpha" };
  return {
    deps: {
      deepClone: (value) => structuredClone(value),
    },
    getEffectiveTemplate: () => ({
      layers: [{ id: "compose", type: "group" }],
    }),
    getLayerHierarchy: (template) => ({
      byId: new Map(template.layers.map((layer) => [layer.id, layer])),
    }),
    refs: {
      stageWrap: { scrollLeft: 210, scrollTop: 90 },
      timelineTracks: { scrollTop: 180 },
      timelineZoomInput: { value: "1" },
    },
    renderCanvasIsolationBreadcrumb: vi.fn(),
    setPreviewZoom: vi.fn(),
    state: {
      canvasIsolationGroupId: "compose",
      compositionWorkspaceViews: new Map(),
      currentTemplate,
      templateSelectionGeneration: 0,
      expandedSceneIds: new Set(["main"]),
      expandedTimelineRowIds: new Set(["scene:main", "group:main:compose"]),
      graphEditorEnabled: true,
      graphEditorViewport: { timeStart: 1 },
      previewZoom: "100",
      timelineOffset: 1.25,
      timelineZoom: 2.5,
    },
    updateCanvasSelectionBox: vi.fn(),
  };
}
