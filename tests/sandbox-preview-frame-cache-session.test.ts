import { afterEach, describe, expect, it, vi } from "vitest";

import {
  resolvePreviewCacheSessionFrame,
  storePreviewCacheSessionFrame,
} from "../src/apps/sandbox/runtime/preview-frame-cache-session";

import { createNativeBitmapFixture } from "./helpers/native-render-fixtures.js";

type ResolveOptions = Parameters<
  typeof resolvePreviewCacheSessionFrame<{ key: string }>
>[0];
type StoreOptions = Parameters<
  typeof storePreviewCacheSessionFrame<{ key: string }>
>[0];
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("sandbox preview cache session", () => {
  it("returns cached frames to the viewer without direct GPU presentation", async () => {
    const bitmap = createNativeBitmapFixture({ height: 90, width: 160 });
    const cacheRequest = { key: "frame:1" };
    const postToParent = vi.fn<ResolveOptions["postToParent"]>();
    const previewPresenter = {
      present:
        vi.fn<NonNullable<ResolveOptions["previewPresenter"]>["present"]>(),
    };
    const previewFrameCache = {
      get: vi.fn<ResolveOptions["previewFrameCache"]["get"]>(async () => ({
        bitmap,
      })),
      getStats: vi.fn<
        () => {
          bytes: number;
          complete: boolean;
          evictions: number;
          frames: number;
          rawBytes: number;
          storage: string;
          totalFrames: number;
        }
      >(() => ({
        bytes: 120,
        complete: true,
        evictions: 0,
        frames: 1,
        rawBytes: 57_600,
        storage: "png",
        totalFrames: 1,
      })),
      prepare: vi.fn<() => { key: string }>(() => cacheRequest),
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
    const bitmap = createNativeBitmapFixture({ height: 90, width: 160 });
    const cacheRequest = { key: "frame:1" };
    const previewFrameCache = {
      store: vi.fn<StoreOptions["previewFrameCache"]["store"]>(
        async () => true,
      ),
    };

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
