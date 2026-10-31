import { createKeyframeDragActions } from "../src/apps/viewer/timeline/interaction/keyframe-drag.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTimelineDragPreview } from "../src/apps/viewer/timeline/interaction/drag-preview";

describe("viewer timeline drag preview", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("starts history only after crossing the drag threshold", () => {
    const { ctx, source } = createPreviewFixture();
    ctx.state.dragMoved = false;
    ctx.state.playing = false;
    const preview = createTimelineDragPreview(ctx, source);
    const startCommand = vi.fn();
    expect(preview.activate(2, startCommand)).toBe(false);
    expect(preview.activate(3, startCommand)).toBe(true);
    expect(preview.activate(4, startCommand)).toBe(true);
    expect(startCommand).toHaveBeenCalledTimes(1);
  });

  it("coalesces updates and settles quality after the drag", () => {
    const { ctx, source, frames, calls, renders } = createPreviewFixture();
    const updates: number[] = [];
    const preview = createTimelineDragPreview(ctx, source);
    expect(ctx.pausePlayback).toHaveBeenCalledWith({
      preservePreparation: true,
      renderCurrentFrame: false,
    });
    expect(ctx.state.timelineDragActive).toBe(true);
    preview.scheduleUpdate(() => updates.push(1));
    preview.scheduleUpdate(() => updates.push(2));
    expect(frames).toHaveLength(1);
    expect(updates).toEqual([]);
    frames[0]?.(0);
    expect(updates).toEqual([2]);
    expect(calls).toEqual(["curve", "crumb", "playhead", "selection"]);
    expect(renders).toEqual([{ interactive: true }]);
    preview.finalize();
    expect(calls.slice(-2)).toEqual(["editor", "settle"]);
    expect(renders).toEqual([{ interactive: true }]);
    expect(ctx.state.timelineDragActive).toBe(false);
  });

  it("discards a pending update when the source is replaced with the same identity", () => {
    const { ctx, source, frames, renders, calls } = createPreviewFixture();
    const preview = createTimelineDragPreview(ctx, source);
    const update = vi.fn();
    preview.scheduleUpdate(update);
    ctx.state.currentTemplate = { ...source };
    frames[0]?.(0);
    preview.finalize();
    expect(update).not.toHaveBeenCalled();
    expect(renders).toEqual([]);
    expect(calls).toEqual([]);
    expect(ctx.state.timelineDragActive).toBe(false);
  });

  it.each(["editorOverrides", "timelineOverrides"])(
    "discards pending work after a foreign %s replacement",
    (owner) => {
      const { ctx, source, frames, calls, renders } = createPreviewFixture();
      const preview = createTimelineDragPreview(ctx, source);
      const update = vi.fn();
      preview.scheduleUpdate(update);
      ctx.state[owner].set(source.id, {});
      frames[0]?.(0);
      preview.finalize();
      expect(update).not.toHaveBeenCalled();
      expect(calls).toEqual([]);
      expect(renders).toEqual([]);
      expect(ctx.state.timelineDragActive).toBe(false);
    },
  );

  it("accepts consecutive updates of its own override revisions", () => {
    const { ctx, source, frames } = createPreviewFixture();
    const preview = createTimelineDragPreview(ctx, source);
    const update = vi.fn(() => {
      ctx.state.timelineOverrides.set(source.id, {});
      ctx.state.editorOverrides.set(source.id, {});
    });
    preview.scheduleUpdate(update);
    frames[0]?.(0);
    preview.scheduleUpdate(update);
    frames[1]?.(0);
    preview.finalize();
    expect(update).toHaveBeenCalledTimes(2);
    expect(ctx.state.timelineDragActive).toBe(false);
  });

  it("does not begin a history command when a pointer move belongs to a replaced source", () => {
    const { ctx, source } = createPreviewFixture();
    class Point {
      parentElement = { getBoundingClientRect: () => ({ width: 100 }) };
    }
    vi.stubGlobal("HTMLElement", Point);
    ctx.state.dragMoved = false;
    ctx.state.playing = false;
    ctx.prepareKeyframeSelectionForPointer = vi.fn();
    ctx.getSelectedKeyframeRefs = () => [
      { trackId: "track", keyframeId: "key" },
    ];
    ctx.setSelectedKeyframes = vi.fn();
    ctx.renderInspector = vi.fn();
    ctx.getEffectiveTimeline = () => ({
      duration: 3,
      phases: [],
      tracks: [{ id: "track", keyframes: [{ id: "key", time: 1, value: 1 }] }],
    });
    ctx.refs.fpsInput = { value: "30" };
    ctx.snapTime = (time: number) => time;
    ctx.timelineDeltaFromPixels = () => 0.5;
    ctx.beginEditorCommand = vi.fn();
    let onMove: ((event: { clientX: number }) => void) | undefined;
    ctx.bindPointerDrag = (
      _id: number,
      _target: unknown,
      callback: typeof onMove,
    ) => {
      onMove = callback;
    };
    Object.assign(
      ctx,
      createKeyframeDragActions(() => ctx),
    );
    ctx.beginKeyframeDrag(
      {
        button: 0,
        clientX: 0,
        currentTarget: new Point(),
        pointerId: 1,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      },
      "track",
      "key",
    );
    ctx.state.currentTemplate = { ...source };
    onMove?.({ clientX: 10 });
    expect(ctx.beginEditorCommand).not.toHaveBeenCalled();
  });

  it("ignores a dequeued frame and further updates after finalization", () => {
    const { ctx, source, frames, renders, calls } = createPreviewFixture();
    const preview = createTimelineDragPreview(ctx, source);
    const update = vi.fn();
    preview.scheduleUpdate(update);
    const oldFrame = frames[0];
    preview.finalize();
    expect(update).toHaveBeenCalledTimes(1);
    calls.splice(0);
    oldFrame?.(0);
    preview.scheduleUpdate(update);
    const startCommand = vi.fn();
    expect(preview.activate(10, startCommand)).toBe(false);
    expect(startCommand).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
    expect(frames).toHaveLength(1);
    expect(calls).toEqual([]);
    expect(renders).toEqual([]);
  });

  it("does not let an old finalizer clear a newer drag session", () => {
    const { ctx, source, frames } = createPreviewFixture();
    const first = createTimelineDragPreview(ctx, source);
    const oldUpdate = vi.fn();
    first.scheduleUpdate(oldUpdate);
    const oldFrame = frames[0];
    const second = createTimelineDragPreview(ctx, source);
    first.finalize();
    oldFrame?.(0);
    expect(oldUpdate).not.toHaveBeenCalled();
    expect(ctx.state.timelineDragActive).toBe(true);
    const update = vi.fn();
    second.scheduleUpdate(update);
    frames.at(-1)?.(0);
    expect(update).toHaveBeenCalledTimes(1);
    second.finalize();
    expect(ctx.state.timelineDragActive).toBe(false);
  });
});

function createPreviewFixture() {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const source = { id: "template" };
  const calls: string[] = [];
  const renders: unknown[] = [];
  const ctx = {
    getEffectiveDuration: () => 3,
    getEffectiveTemplate: () => ({ clips: [], scenes: [] }),
    getEffectiveTimeline: () => ({ phases: [], tracks: [] }),
    normalizeScenes: () => [],
    pausePlayback: vi.fn(() => {
      ctx.state.playing = false;
    }),
    refs: { timelineTracks: { querySelectorAll: () => [] } },
    renderCurrentFrame(options?: unknown) {
      renders.push(options);
    },
    renderCurveEditor: () => calls.push("curve"),
    renderSelectionCrumb: () => calls.push("crumb"),
    settlePreviewAfterInteraction: () => calls.push("settle"),
    renderTimelineEditor: () => calls.push("editor"),
    state: {
      currentTemplate: source,
      editorOverrides: new Map(),
      timelineOverrides: new Map(),
      dragMoved: true,
      playing: true,
      timelineDragActive: false,
    },
    updateCanvasSelectionBox: () => calls.push("selection"),
    updateTimelinePlayhead: () => calls.push("playhead"),
  } as any;
  return { ctx, source, frames, calls, renders };
}
