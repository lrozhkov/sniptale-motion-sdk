import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import { requiredEntry } from "./helpers/required-entry.js";
const SOURCE_VIEWPORT = {
  templateId: "alpha",
  timeStart: 1,
  timeEnd: 3,
  valueMin: 0,
  valueMax: 1,
};
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  captureCompositionWorkspaceView,
  restoreCompositionWorkspaceView,
} from "../src/apps/viewer/templates/workspace-view-state";

describe("composition workspace view state", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
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
      if (change === "source")
        ctx.state.currentTemplate = { id: "beta", duration: 4 };
      if (change === "generation") ctx.state.templateSelectionGeneration += 1;
      if (change === "stored-view") captureCompositionWorkspaceView(ctx);
      requiredEntry(frames, 0)(0);
      expect(ctx.refs.timelineTracks.scrollTop).toBe(4);
      expect(ctx.refs.stageWrap.scrollLeft).toBe(5);
      expect(ctx.refs.stageWrap.scrollTop).toBe(6);
      expect(ctx.renderCanvasIsolationBreadcrumb).not.toHaveBeenCalled();
      expect(ctx.updateCanvasSelectionBox).not.toHaveBeenCalled();
    });
  }

  it("restores canvas, timeline, tree, graph, and isolation view per composition", () => {
    const ctx = createContext();
    const requestAnimationFrame = vi.fn<
      typeof globalThis.requestAnimationFrame
    >((callback) => {
      callback(0);
      return 1;
    });
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
    expect(ctx.state.graphEditorViewport).toEqual(SOURCE_VIEWPORT);
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

function createContext() {
  const ctx = createViewerContextFixture();
  ctx.state.currentTemplate = {
    id: "alpha",
    duration: 4,
    layers: [{ id: "compose", type: "group" }],
  };
  ctx.state.canvasIsolationGroupId = "compose";
  ctx.state.expandedSceneIds = new Set(["main"]);
  ctx.state.expandedTimelineRowIds = new Set([
    "scene:main",
    "group:main:compose",
  ]);
  ctx.state.graphEditorEnabled = true;
  ctx.state.graphEditorViewport = structuredClone(SOURCE_VIEWPORT);
  ctx.state.previewZoom = "100";
  ctx.state.timelineOffset = 1.25;
  ctx.state.timelineZoom = 2.5;
  ctx.refs.stageWrap.scrollLeft = 210;
  ctx.refs.stageWrap.scrollTop = 90;
  ctx.refs.timelineTracks.scrollTop = 180;
  ctx.refs.timelineZoomInput.value = "1";
  const renderCanvasIsolationBreadcrumb = vi
    .spyOn(ctx, "renderCanvasIsolationBreadcrumb")
    .mockImplementation(() => {});
  const setPreviewZoom = vi
    .spyOn(ctx, "setPreviewZoom")
    .mockImplementation(() => {});
  const updateCanvasSelectionBox = vi
    .spyOn(ctx, "updateCanvasSelectionBox")
    .mockImplementation(() => {});
  return Object.assign(ctx, {
    renderCanvasIsolationBreadcrumb,
    setPreviewZoom,
    updateCanvasSelectionBox,
  });
}
