import { describe, expect, it } from "vitest";

import {
  resolvePreviewFrameCachePolicy,
  shouldCapturePlaybackVideoCacheFrame,
  shouldRecordPreviewFrameCacheResult,
} from "../src/apps/viewer/rendering/preview-cache-policy";

describe("viewer preview frame cache policy", () => {
  it("captures video cache frames only for renders started by active playback", () => {
    expect(
      shouldCapturePlaybackVideoCacheFrame({
        playing: true,
        previewVideoCache: { recording: true },
      }),
    ).toBe(true);
    expect(
      shouldCapturePlaybackVideoCacheFrame({
        playing: false,
        previewVideoCache: { recording: true },
      }),
    ).toBe(false);
    expect(
      shouldCapturePlaybackVideoCacheFrame({
        playing: true,
        previewVideoCache: { recording: false },
      }),
    ).toBe(false);
  });

  it("requests lossless cache persistence for a paused first frame", () => {
    expect(
      resolvePreviewFrameCachePolicy({
        playing: false,
        previewCacheEnabled: true,
      }),
    ).toEqual({ requested: true, warming: false });
  });

  it("warms only during playback and bypasses cache while transforming", () => {
    expect(
      resolvePreviewFrameCachePolicy({
        playing: true,
        previewCacheEnabled: true,
        previewVideoCache: { recording: false },
      }),
    ).toEqual({ requested: true, warming: true });
    expect(
      resolvePreviewFrameCachePolicy({
        canvasTransformDragActive: true,
        playing: true,
        previewCacheEnabled: true,
      }),
    ).toEqual({ requested: false, warming: false });
    expect(
      resolvePreviewFrameCachePolicy({
        playing: true,
        previewCacheEnabled: true,
        previewVideoCache: { recording: true },
      }),
    ).toEqual({ requested: false, warming: false });
    expect(
      resolvePreviewFrameCachePolicy({
        playing: false,
        previewCacheEnabled: true,
        previewVideoCache: { ready: true },
      }),
    ).toEqual({ requested: false, warming: false });
    expect(
      resolvePreviewFrameCachePolicy(
        {
          playing: false,
          previewCacheEnabled: true,
          previewVideoCache: {},
        },
        true,
      ),
    ).toEqual({ requested: false, warming: false });
  });

  it("keeps live mode free of preview cache work", () => {
    expect(
      resolvePreviewFrameCachePolicy({
        playing: true,
        previewCacheEnabled: false,
      }),
    ).toEqual({ requested: false, warming: false });
  });

  it("does not let an in-flight frame overwrite video cache ownership", () => {
    expect(
      shouldRecordPreviewFrameCacheResult(
        { previewVideoCache: { ready: true } },
        null,
      ),
    ).toBe(false);
    expect(
      shouldRecordPreviewFrameCacheResult({ previewVideoCache: {} }, null),
    ).toBe(true);
    expect(
      shouldRecordPreviewFrameCacheResult(
        { previewVideoCache: {} },
        { captured: true },
      ),
    ).toBe(false);
  });
});
