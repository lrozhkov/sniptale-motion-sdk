import { describe, expect, it, vi } from "vitest";
import {
  createLazyGraphEditorActions,
  type GraphLazyContext,
} from "../src/apps/viewer/graph-editor/lazy.js";
import type { GraphRuntimeActions } from "../src/apps/viewer/graph-editor/contract.js";
import { createViewerState } from "../src/apps/viewer/app/state.js";

describe("graph editor lazy actions", () => {
  it("constructs without reading context or loading the runtime", () => {
    const read = vi.fn(() => fixture().ctx);
    const load = vi.fn(async () => runtime());
    createLazyGraphEditorActions(read, load);
    expect(read).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
  });

  it("reports availability without importing the runtime", () => {
    const { ctx, timeline } = fixture();
    const load = vi.fn(async () => runtime());
    const actions = createLazyGraphEditorActions(() => ctx, load);
    actions.renderCurveEditor(timeline);
    expect(ctx.refs.graphEditorButton.disabled).toBe(false);
    expect(ctx.refs.curveEditor.hidden).toBe(true);
    expect(load).not.toHaveBeenCalled();
    ctx.state.selectedKeyframes = [];
    actions.renderCurveEditor(timeline);
    expect(ctx.refs.graphEditorButton.disabled).toBe(true);
  });

  it("does not offer non-finite values as editable numeric curves", () => {
    const { ctx, timeline } = fixture();
    const actions = createLazyGraphEditorActions(
      () => ctx,
      async () => runtime(),
    );
    const track = timeline.tracks[0];
    const point = track?.keyframes[0];
    if (!point) throw new Error("Expected a numeric fixture point");
    point.value = Number.NaN;
    actions.renderCurveEditor(timeline);
    expect(ctx.refs.graphEditorButton.disabled).toBe(true);
  });

  it("shares an in-flight import and preserves a later close request", async () => {
    const { ctx } = fixture();
    const deferred = Promise.withResolvers<GraphRuntimeActions>();
    const load = vi.fn(() => deferred.promise);
    const actions = createLazyGraphEditorActions(() => ctx, load);
    const open = actions.toggleGraphEditor();
    expect(ctx.state.graphEditorEnabled).toBe(true);
    await actions.toggleGraphEditor();
    expect(ctx.state.graphEditorEnabled).toBe(false);
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(1);
    const loaded = runtime();
    deferred.resolve(loaded);
    await open;
    expect(loaded.toggleGraphEditor).toHaveBeenCalledWith(false);
    expect(ctx.state.graphEditorEnabled).toBe(false);
    expect(await actions.fitGraphEditor()).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("reports a failed import, stops automatic retry, and allows an explicit retry", async () => {
    const { ctx, timeline } = fixture();
    const loaded = runtime();
    const load = vi
      .fn<() => Promise<GraphRuntimeActions>>()
      .mockRejectedValueOnce(new Error("load rejected"))
      .mockResolvedValue(loaded);
    const actions = createLazyGraphEditorActions(() => ctx, load);
    await actions.toggleGraphEditor(true);
    expect(ctx.logDiagnostic).toHaveBeenCalledOnce();
    expect(ctx.logDiagnostic).toHaveBeenCalledWith(
      "Could not load the graph editor. Try the action again.",
      "error",
    );
    expect(ctx.state.graphEditorEnabled).toBe(false);
    actions.renderCurveEditor(timeline);
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(1);
    expect(await actions.fitGraphEditor()).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it.each(["source", "viewport"])(
    "discards fit and zoom requested before a foreign %s replacement",
    async (changed) => {
      const { ctx } = fixture();
      const deferred = Promise.withResolvers<GraphRuntimeActions>();
      const actions = createLazyGraphEditorActions(
        () => ctx,
        () => deferred.promise,
      );
      const fit = actions.fitGraphEditor("all");
      const zoom = actions.zoomGraphEditor(0.8);
      if (changed === "source")
        ctx.state.currentTemplate = { id: "source", duration: 4 };
      else
        ctx.state.graphEditorViewport = {
          templateId: "source",
          timeStart: 1,
          timeEnd: 2,
          valueMin: 0,
          valueMax: 1,
        };
      const loaded = runtime();
      deferred.resolve(loaded);
      expect(await fit).toBe(false);
      expect(await zoom).toBe(false);
      expect(loaded.fitGraphEditor).not.toHaveBeenCalled();
      expect(loaded.zoomGraphEditor).not.toHaveBeenCalled();
    },
  );

  it("applies every wheel zoom immediately once the runtime is available", async () => {
    const { ctx } = fixture();
    const loaded = runtime();
    loaded.zoomGraphEditor = vi.fn(() => {
      ctx.state.graphEditorViewport = {
        templateId: "source",
        timeStart: 0,
        timeEnd: 1,
        valueMin: 0,
        valueMax: 1,
      };
      return true;
    });
    const actions = createLazyGraphEditorActions(
      () => ctx,
      async () => loaded,
    );
    await actions.fitGraphEditor();
    const first = actions.zoomGraphEditor(0.8);
    const second = actions.zoomGraphEditor(0.8);
    expect(loaded.zoomGraphEditor).toHaveBeenCalledTimes(2);
    expect(await first).toBe(true);
    expect(await second).toBe(true);
  });

  it("keeps setters synchronous before loading and delegates after loading", async () => {
    const { ctx } = fixture();
    const loaded = runtime();
    const actions = createLazyGraphEditorActions(
      () => ctx,
      async () => loaded,
    );
    const viewport = {
      templateId: "source",
      timeStart: 1,
      timeEnd: 2,
      valueMin: 0,
      valueMax: 1,
    };
    actions.setGraphEditorViewport(viewport, { render: false });
    actions.setGraphEditorLinkedHandles(false);
    expect(ctx.state.graphEditorViewport).toBe(viewport);
    expect(ctx.state.graphEditorLinkedHandles).toBe(false);
    expect(await actions.fitGraphEditor()).toBe(true);
    actions.setGraphEditorViewport(viewport);
    actions.setGraphEditorLinkedHandles(true);
    expect(loaded.setGraphEditorViewport).toHaveBeenCalledWith(viewport, {});
    expect(loaded.setGraphEditorLinkedHandles).toHaveBeenCalledWith(true);
  });
});

function fixture() {
  const source = { id: "source", duration: 4 };
  const timeline = {
    duration: 4,
    phases: [],
    tracks: [{ id: "track", keyframes: [{ id: "key", time: 1, value: 1 }] }],
  };
  const ctx: GraphLazyContext = {
    state: {
      ...createViewerState(),
      currentTemplate: source,
      selectedKeyframes: [{ trackId: "track", keyframeId: "key" }],
    },
    refs: {
      graphEditorButton: { disabled: true, setAttribute: vi.fn() },
      timelineEditor: { classList: { remove: vi.fn() } },
      curveEditor: { hidden: false, replaceChildren: vi.fn() },
    },
    deps: { t: (_key, fallback = "") => fallback },
    logDiagnostic: vi.fn(),
    getEffectiveTimeline: () => timeline,
  };
  return { ctx, timeline };
}

function runtime(): GraphRuntimeActions {
  return {
    toggleGraphEditor: vi.fn(),
    fitGraphEditor: vi.fn(() => true),
    zoomGraphEditor: vi.fn(() => true),
    setGraphEditorViewport: vi.fn(),
    setGraphEditorLinkedHandles: vi.fn(),
    renderCurveEditor: vi.fn(),
    updateGraphEditorPlayhead: vi.fn(),
    handleGraphEditorWheel: vi.fn(),
    beginGraphEditorPan: vi.fn(),
    beginGraphKeyframeDrag: vi.fn(),
    beginGraphBezierHandleDrag: vi.fn(),
    beginGraphSelectionScale: vi.fn(),
  };
}
