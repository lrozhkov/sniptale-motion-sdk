import { requiredEntry } from "./helpers/required-entry.js";
import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  readCanvasSelectionViewport,
  scheduleCanvasSelectionPlaybackUpdate,
} from "../src/apps/viewer/canvas/selection-viewport";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("viewer canvas selection viewport", () => {
  it("reuses stable layout geometry for playback frames", () => {
    const canvasRect = createRect(10, 20, 640, 360);
    const stageRect = createRect(4, 6, 700, 420);
    const canvasRead = vi.fn<HTMLElement["getBoundingClientRect"]>(
      () => canvasRect,
    );
    const stageRead = vi.fn<HTMLElement["getBoundingClientRect"]>(
      () => stageRect,
    );
    const ctx = createViewportContext(canvasRead, stageRead);

    const initial = readCanvasSelectionViewport(ctx, false);
    const playback = readCanvasSelectionViewport(ctx, true);

    expect(playback).toBe(initial);
    expect(canvasRead).toHaveBeenCalledTimes(1);
    expect(stageRead).toHaveBeenCalledTimes(1);
  });

  it("refreshes the cache for an explicit layout update", () => {
    const canvasRead = vi
      .fn<HTMLElement["getBoundingClientRect"]>()
      .mockReturnValueOnce(createRect(10, 20, 640, 360))
      .mockReturnValueOnce(createRect(15, 25, 800, 450));
    const stageRead = vi
      .fn<HTMLElement["getBoundingClientRect"]>()
      .mockReturnValueOnce(createRect(4, 6, 700, 420))
      .mockReturnValueOnce(createRect(5, 7, 860, 510));
    const ctx = createViewportContext(canvasRead, stageRead);

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
    const requestAnimationFrame = vi.fn<
      typeof globalThis.requestAnimationFrame
    >((callback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    const ctx = createViewerContextFixture();
    const updateCanvasSelectionBox = vi
      .spyOn(ctx, "updateCanvasSelectionBox")
      .mockImplementation(() => {});
    ctx.state.playing = true;
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
    try {
      scheduleCanvasSelectionPlaybackUpdate(ctx);
      scheduleCanvasSelectionPlaybackUpdate(ctx);
      expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

      requiredEntry(callbacks, 0)(42);
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
    x: left,
    y: top,
    toJSON: () => ({ x: left, y: top, width, height }),
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
  } satisfies DOMRect;
}

function createViewportContext(
  canvasRead: HTMLElement["getBoundingClientRect"],
  stageRead: HTMLElement["getBoundingClientRect"],
) {
  const ctx = createViewerContextFixture();
  const stage = Object.assign(new HTMLElement(), {
    getBoundingClientRect: stageRead,
  });
  Object.assign(ctx.refs.canvas, { getBoundingClientRect: canvasRead });
  Object.defineProperty(ctx.refs.canvas, "parentElement", { value: stage });
  return ctx;
}
