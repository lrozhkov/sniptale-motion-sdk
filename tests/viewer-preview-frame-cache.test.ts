import { describe, expect, it } from "vitest";

import { recordPreviewFrameCacheResult } from "../src/apps/viewer/rendering/preview-frame-cache";

describe("viewer preview frame cache metrics", () => {
  it("records validated worker cache results", () => {
    const state = {
      previewFrameCacheBytes: 0,
      previewFrameCacheComplete: false,
      previewFrameCacheEntries: 0,
      previewFrameCacheEvictions: 0,
      previewFrameCacheFrames: 0,
      previewFrameCacheHits: 0,
      previewFrameCacheMisses: 0,
      previewFrameCacheRawBytes: 0,
      previewFrameCacheStorage: "none",
      previewFrameCacheStoreMs: 0,
      previewFrameCacheTotalFrames: 0,
    };

    recordPreviewFrameCacheResult(state, {
      previewCacheBytes: 4096,
      previewCacheComplete: true,
      previewCacheEntries: 4,
      previewCacheEvictions: 1,
      previewCacheFrames: 4,
      previewCacheHit: true,
      previewCacheRawBytes: 16384,
      previewCacheStorage: "png",
      previewCacheStoreMs: 3.5,
      previewCacheTotalFrames: 4,
    });
    recordPreviewFrameCacheResult(state, { previewCacheHit: false });

    expect(state).toEqual({
      previewFrameCacheBytes: 4096,
      previewFrameCacheComplete: true,
      previewFrameCacheEntries: 4,
      previewFrameCacheEvictions: 1,
      previewFrameCacheFrames: 4,
      previewFrameCacheHits: 1,
      previewFrameCacheMisses: 1,
      previewFrameCacheRawBytes: 16384,
      previewFrameCacheStorage: "png",
      previewFrameCacheStoreMs: 3.5,
      previewFrameCacheTotalFrames: 4,
    });
  });
});
