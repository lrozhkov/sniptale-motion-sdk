import type { ViewerAppContext } from "../src/apps/viewer/app/context.js";
import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import { requiredEntry } from "./helpers/required-entry.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTimelineDragPreview } from "../src/apps/viewer/timeline/interaction/drag-preview";

describe("viewer timeline drag preview", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("starts history only after crossing the drag threshold", () => {
    const { ctx, source } = createPreviewFixture();
    ctx.state.dragMoved = false;
    ctx.state.playing = false;
    const preview = createTimelineDragPreview(ctx, source);
    const startCommand = vi.fn<() => void>();
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
    requiredEntry(frames, 0)(0);
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
    const update = vi.fn<() => void>();
    preview.scheduleUpdate(update);
    ctx.state.currentTemplate = { ...source };
    requiredEntry(frames, 0)(0);
    preview.finalize();
    expect(update).not.toHaveBeenCalled();
    expect(renders).toEqual([]);
    expect(calls).toEqual([]);
    expect(ctx.state.timelineDragActive).toBe(false);
  });

  it.each(["editorOverrides", "timelineOverrides"] as const)(
    "discards pending work after a foreign %s replacement",
    (owner) => {
      const { ctx, source, frames, calls, renders } = createPreviewFixture();
      const preview = createTimelineDragPreview(ctx, source);
      const update = vi.fn<() => void>();
      preview.scheduleUpdate(update);
      ctx.state[owner].set(source.id, {});
      requiredEntry(frames, 0)(0);
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
    const update = vi.fn<() => void>(() => {
      ctx.state.timelineOverrides.set(source.id, {});
      ctx.state.editorOverrides.set(source.id, {});
    });
    preview.scheduleUpdate(update);
    requiredEntry(frames, 0)(0);
    preview.scheduleUpdate(update);
    requiredEntry(frames, 1)(0);
    preview.finalize();
    expect(update).toHaveBeenCalledTimes(2);
    expect(ctx.state.timelineDragActive).toBe(false);
  });

  it("does not begin a history command when a pointer move belongs to a replaced source", () => {
    const { ctx, source } = createPreviewFixture();
    const target = new HTMLElement();
    const parent = new HTMLElement();
    Object.defineProperties(target, { parentElement: { value: parent } });
    Object.assign(parent, {
      getBoundingClientRect: (): DOMRect => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 100,
        bottom: 20,
        width: 100,
        height: 20,
        toJSON: () => ({}),
      }),
    });
    class FixturePointerEvent {
      button = 0;
      shiftKey = false;
      metaKey = false;
      ctrlKey = false;
      pointerId = 1;
      currentTarget = target;
      clientX: number;
      constructor(_type: string, options: PointerEventInit = {}) {
        this.clientX = options.clientX ?? 0;
      }
      preventDefault(): void {}
      stopPropagation(): void {}
    }
    vi.stubGlobal("PointerEvent", FixturePointerEvent);
    ctx.state.dragMoved = false;
    ctx.state.playing = false;
    vi.spyOn(ctx, "prepareKeyframeSelectionForPointer").mockImplementation(
      () => {},
    );
    vi.spyOn(ctx, "getSelectedKeyframeRefs").mockReturnValue([
      { trackId: "track", keyframeId: "key" },
    ]);
    vi.spyOn(ctx, "setSelectedKeyframes").mockImplementation(() => {});
    vi.spyOn(ctx, "renderInspector").mockImplementation(() => {});
    vi.spyOn(ctx, "getEffectiveTimeline").mockReturnValue({
      duration: 3,
      phases: [],
      tracks: [
        {
          id: "track",
          property: "x",
          layerId: "layer",
          keyframes: [{ id: "key", time: 1, value: 1 }],
        },
      ],
    });
    ctx.refs.fpsInput.value = "30";
    vi.spyOn(ctx, "snapTime").mockImplementation((time) => time);
    vi.spyOn(ctx, "timelineDeltaFromPixels").mockReturnValue(0.5);
    const beginEditorCommand = vi
      .spyOn(ctx, "beginEditorCommand")
      .mockImplementation(() => {});
    let onMove: Parameters<ViewerAppContext["bindPointerDrag"]>[2] | undefined;
    vi.spyOn(ctx, "bindPointerDrag").mockImplementation(
      (_id, _target, callback) => {
        onMove = callback;
      },
    );
    ctx.beginKeyframeDrag(new PointerEvent("pointerdown"), "track", "key");
    ctx.state.currentTemplate = { ...source };
    if (!onMove) throw new Error("Pointer drag callback was not registered.");
    onMove(new PointerEvent("pointermove", { clientX: 10 }));
    expect(beginEditorCommand).not.toHaveBeenCalled();
  });

  it("ignores a dequeued frame and further updates after finalization", () => {
    const { ctx, source, frames, renders, calls } = createPreviewFixture();
    const preview = createTimelineDragPreview(ctx, source);
    const update = vi.fn<() => void>();
    preview.scheduleUpdate(update);
    const oldFrame = requiredEntry(frames, 0);
    preview.finalize();
    expect(update).toHaveBeenCalledTimes(1);
    calls.splice(0);
    oldFrame(0);
    preview.scheduleUpdate(update);
    const startCommand = vi.fn<() => void>();
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
    const oldUpdate = vi.fn<() => void>();
    first.scheduleUpdate(oldUpdate);
    const oldFrame = requiredEntry(frames, 0);
    const second = createTimelineDragPreview(ctx, source);
    first.finalize();
    oldFrame(0);
    expect(oldUpdate).not.toHaveBeenCalled();
    expect(ctx.state.timelineDragActive).toBe(true);
    const update = vi.fn<() => void>();
    second.scheduleUpdate(update);
    requiredEntry(frames, frames.length - 1)(0);
    expect(update).toHaveBeenCalledTimes(1);
    second.finalize();
    expect(ctx.state.timelineDragActive).toBe(false);
  });
});

function createPreviewFixture() {
  const ctx = createViewerContextFixture();
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn<typeof cancelAnimationFrame>());
  const source = {
    id: "template",
    duration: 3,
    clips: [],
    scenes: [],
    timeline: { phases: [], tracks: [] },
  };
  ctx.state.currentTemplate = source;
  ctx.state.dragMoved = true;
  ctx.state.playing = true;
  const calls: string[] = [];
  const renders: Parameters<ViewerAppContext["renderCurrentFrame"]>[0][] = [];
  Object.assign(ctx.refs.timelineTracks, { querySelectorAll: () => [] });
  const pausePlayback = vi
    .spyOn(ctx, "pausePlayback")
    .mockImplementation(() => {
      ctx.state.playing = false;
      return true;
    });
  vi.spyOn(ctx, "renderCurrentFrame").mockImplementation(async (options) => {
    renders.push(options);
  });
  vi.spyOn(ctx, "renderCurveEditor").mockImplementation(() => {
    calls.push("curve");
  });
  vi.spyOn(ctx, "renderSelectionCrumb").mockImplementation(() => {
    calls.push("crumb");
  });
  vi.spyOn(ctx, "settlePreviewAfterInteraction").mockImplementation(
    async () => {
      calls.push("settle");
      return true;
    },
  );
  vi.spyOn(ctx, "renderTimelineEditor").mockImplementation(() => {
    calls.push("editor");
  });
  vi.spyOn(ctx, "updateCanvasSelectionBox").mockImplementation(() => {
    calls.push("selection");
  });
  vi.spyOn(ctx, "updateTimelinePlayhead").mockImplementation(() => {
    calls.push("playhead");
  });
  return {
    ctx: Object.assign(ctx, { pausePlayback }),
    source,
    frames,
    calls,
    renders,
  };
}
