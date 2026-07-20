import { describe, expect, it, vi } from "vitest";

import {
  readCanvasSelectionViewport,
  scheduleCanvasSelectionPlaybackUpdate,
} from "../src/apps/viewer/canvas/selection-viewport";

describe("viewer canvas selection viewport", () => {
  it("reuses stable layout geometry for playback frames", () => {
    const canvasRect = createRect(10, 20, 640, 360);
    const stageRect = createRect(4, 6, 700, 420);
    const canvasRead = vi.fn(() => canvasRect);
    const stageRead = vi.fn(() => stageRect);
    const ctx = {
      refs: {
        canvas: {
          getBoundingClientRect: canvasRead,
          parentElement: { getBoundingClientRect: stageRead },
        },
      },
      state: { canvasSelectionViewport: null },
    } as any;

    const initial = readCanvasSelectionViewport(ctx, false);
    const playback = readCanvasSelectionViewport(ctx, true);

    expect(playback).toBe(initial);
    expect(canvasRead).toHaveBeenCalledTimes(1);
    expect(stageRead).toHaveBeenCalledTimes(1);
  });

  it("refreshes the cache for an explicit layout update", () => {
    const canvasRead = vi
      .fn()
      .mockReturnValueOnce(createRect(10, 20, 640, 360))
      .mockReturnValueOnce(createRect(15, 25, 800, 450));
    const stageRead = vi
      .fn()
      .mockReturnValueOnce(createRect(4, 6, 700, 420))
      .mockReturnValueOnce(createRect(5, 7, 860, 510));
    const ctx = {
      refs: {
        canvas: {
          getBoundingClientRect: canvasRead,
          parentElement: { getBoundingClientRect: stageRead },
        },
      },
      state: { canvasSelectionViewport: null },
    } as any;

    readCanvasSelectionViewport(ctx, false);
    const refreshed = readCanvasSelectionViewport(ctx, false);

    expect(refreshed.canvasRect).toMatchObject({
      height: 450,
      left: 15,
      top: 25,
      width: 800,
    });
    expect(canvasRead).toHaveBeenCalledTimes(2);
    expect(stageRead).toHaveBeenCalledTimes(2);
  });

  it("coalesces playback overlay updates outside render completion", () => {
    const callbacks: FrameRequestCallback[] = [];
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    const updateCanvasSelectionBox = vi.fn();
    const ctx = {
      canvasSelectionPlaybackFrame: 0,
      state: { playing: true },
      updateCanvasSelectionBox,
    } as any;
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
    try {
      scheduleCanvasSelectionPlaybackUpdate(ctx);
      scheduleCanvasSelectionPlaybackUpdate(ctx);
      expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

      callbacks[0](42);
      expect(updateCanvasSelectionBox).toHaveBeenCalledWith({
        playbackFrame: true,
      });
      expect(ctx.canvasSelectionPlaybackFrame).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

function createRect(left: number, top: number, width: number, height: number) {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
  } as DOMRect;
}
