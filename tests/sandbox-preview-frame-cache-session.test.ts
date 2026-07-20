import { describe, expect, it, vi } from "vitest";

import {
  resolvePreviewCacheSessionFrame,
  storePreviewCacheSessionFrame,
} from "../src/apps/sandbox/runtime/preview-frame-cache-session";

describe("sandbox preview cache session", () => {
  it("returns cached frames to the viewer without direct GPU presentation", async () => {
    const bitmap = { close: vi.fn(), height: 90, width: 160 };
    const cacheRequest = { key: "frame:1" };
    const postToParent = vi.fn();
    const previewPresenter = { present: vi.fn() };
    const previewFrameCache = {
      get: vi.fn(async () => ({ bitmap })),
      getStats: vi.fn(() => ({
        bytes: 120,
        complete: true,
        evictions: 0,
        frames: 1,
        rawBytes: 57_600,
        storage: "png",
        totalFrames: 1,
      })),
      prepare: vi.fn(() => cacheRequest),
    };

    const result = await resolvePreviewCacheSessionFrame({
      message: {
        directPresentation: false,
        requestId: "frame:1",
        sequenceId: 7,
      },
      postToParent,
      previewFrameCache,
      previewPresenter,
      startedAt: performance.now(),
    });

    expect(result).toEqual({
      cacheRequest,
      directPresentation: false,
      handled: true,
    });
    expect(previewPresenter.present).not.toHaveBeenCalled();
    expect(postToParent).toHaveBeenCalledWith(
      expect.objectContaining({
        bitmap,
        previewCacheComplete: true,
        previewCacheHit: true,
        requestId: "frame:1",
        sequenceId: 7,
      }),
      [bitmap],
    );
  });

  it("keeps the weak-GPU playback cache compact instead of retaining raw frames", async () => {
    const bitmap = { height: 90, width: 160 };
    const cacheRequest = { key: "frame:1" };
    const previewFrameCache = { store: vi.fn(async () => true) };

    await storePreviewCacheSessionFrame({
      bitmap,
      bindingReads: undefined,
      cacheRequest,
      directPresentation: false,
      previewFrameCache,
      previewPresenter: undefined,
    });

    expect(previewFrameCache.store).toHaveBeenCalledWith(
      cacheRequest,
      bitmap,
      undefined,
      { allowReusableBitmap: false },
    );
  });
});
