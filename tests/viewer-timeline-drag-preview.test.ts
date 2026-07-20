import { afterEach, describe, expect, it, vi } from "vitest";

import {
  activateTimelineDrag,
  createTimelineDragPreview,
} from "../src/apps/viewer/timeline/interaction/drag-preview";

describe("viewer timeline drag preview", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("starts history only after crossing the drag threshold", () => {
    const ctx = { state: { dragMoved: false } } as any;
    const startCommand = vi.fn();

    expect(activateTimelineDrag(ctx, 2, startCommand)).toBe(false);
    expect(activateTimelineDrag(ctx, 3, startCommand)).toBe(true);
    expect(activateTimelineDrag(ctx, 4, startCommand)).toBe(true);
    expect(startCommand).toHaveBeenCalledTimes(1);
  });

  it("coalesces updates and settles quality after the drag", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const calls: string[] = [];
    const renders: any[] = [];
    const ctx = {
      getEffectiveDuration: () => 3,
      getEffectiveTemplate: () => ({ clips: [], scenes: [] }),
      getEffectiveTimeline: () => ({ phases: [], tracks: [] }),
      normalizeScenes: () => [],
      pausePlayback: vi.fn(() => {
        ctx.state.playing = false;
      }),
      refs: {
        timelineTracks: {
          querySelectorAll: () => [],
        },
      },
      renderCurrentFrame(options) {
        renders.push(options);
      },
      renderCurveEditor: () => calls.push("curve"),
      renderSelectionCrumb: () => calls.push("crumb"),
      settlePreviewAfterInteraction: () => calls.push("settle"),
      renderTimelineEditor: () => calls.push("editor"),
      state: {
        dragMoved: true,
        playing: true,
        timelineDragActive: false,
      },
      updateCanvasSelectionBox: () => calls.push("selection"),
      updateTimelinePlayhead: () => calls.push("playhead"),
    } as any;
    const updates: number[] = [];
    const preview = createTimelineDragPreview(ctx, { id: "template" });

    expect(ctx.pausePlayback).toHaveBeenCalledWith({
      preservePreparation: true,
      renderCurrentFrame: false,
    });
    expect(ctx.state.timelineDragActive).toBe(true);
    preview.scheduleUpdate(() => updates.push(1));
    preview.scheduleUpdate(() => updates.push(2));
    expect(frames).toHaveLength(1);
    expect(updates).toEqual([]);

    frames[0](0);
    expect(updates).toEqual([2]);
    expect(calls).toEqual(["curve", "crumb", "playhead", "selection"]);
    expect(renders).toEqual([{ interactive: true }]);

    preview.finalize();
    expect(calls.slice(-2)).toEqual(["editor", "settle"]);
    expect(renders).toEqual([{ interactive: true }]);
    expect(ctx.state.timelineDragActive).toBe(false);
  });
});
