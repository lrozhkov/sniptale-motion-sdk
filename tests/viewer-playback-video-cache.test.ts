import { createViewerPlaybackFixture } from "./helpers/viewer-playback-fixture.js";
import { createNativeBitmapFixture } from "./helpers/native-render-fixtures.js";
import { createNativeVideoFixture } from "./helpers/native-video-fixture.js";
import { requiredEntry } from "./helpers/required-entry.js";
import { createStarterDocument } from "../src/apps/cli/starter.js";
import type { EditorTemplateSource } from "../src/apps/viewer/templates/model.js";
import type { PlaybackVideoCacheEncoder } from "../src/apps/viewer/playback/video-cache-encoder.js";
import type { DirectRenderResponsePort } from "../src/apps/viewer/transport/direct-render-channel.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { beginPreviewCacheWarm } from "../src/apps/viewer/playback/cache-warm";
import {
  createPlaybackVideoCacheKey,
  createPlaybackVideoCacheSegmentFingerprint,
  createPlaybackVideoCacheStorageKey,
  isPlaybackVideoCacheCurrent,
  shouldPreferPlaybackVideoCache,
} from "../src/apps/viewer/playback/video-cache-key";
import {
  beginPlaybackVideoCache,
  capturePlaybackVideoCacheFrame,
  invalidatePlaybackVideoCache,
  syncPlaybackVideoCache,
} from "../src/apps/viewer/playback/video-cache";
import { fallBackToExactFrameCache } from "../src/apps/viewer/playback/video-cache-fallback";

function createContext() {
  const ctx = createViewerPlaybackFixture();
  const bitmap = createNativeBitmapFixture({ width: 1280, height: 720 });
  const video = createNativeVideoFixture();
  const encoder = {
    addFrame: vi
      .fn<PlaybackVideoCacheEncoder["addFrame"]>()
      .mockResolvedValue(undefined),
    cancel: vi
      .fn<PlaybackVideoCacheEncoder["cancel"]>()
      .mockResolvedValue(undefined),
    codec: "avc",
    finalize: vi
      .fn<PlaybackVideoCacheEncoder["finalize"]>()
      .mockResolvedValue(new Blob(["cached-video"])),
    mimeType: "video/mp4",
    segmented: true,
  } satisfies PlaybackVideoCacheEncoder;
  ctx.state.currentTemplate = { id: "template", duration: 0.1 };
  ctx.state.playing = true;
  ctx.state.previewCacheEnabled = true;
  ctx.state.previewFrameCacheStorage = "video-recording";
  ctx.state.previewVideoCache = {
    ...ctx.state.previewVideoCache,
    codec: "avc",
    duration: 0.1,
    encoder,
    fps: 10,
    generation: 1,
    key: "cache-key",
    recording: true,
    rangeEndFrame: 2,
    rangeEndTime: 0.1,
    pendingSegmentIndexes: [0],
    segmentPlan: [
      { endFrame: 2, endTime: 0.1, index: 0, startFrame: 0, startTime: 0 },
    ],
  };
  ctx.refs.cachedPreviewVideo = video;
  ctx.refs.directPreviewCanvas.hidden = false;
  ctx.refs.fastPreviewCanvas.hidden = false;
  const beginPlaybackCacheWarm = vi
    .spyOn(ctx, "beginPlaybackCacheWarm")
    .mockImplementation(() =>
      beginPreviewCacheWarm(
        ctx.state,
        { currentTime: 0, duration: 0.1, fps: 10 },
        true,
      ),
    );
  beginPreviewCacheWarm(
    ctx.state,
    { currentTime: 0, duration: 0.1, fps: 10 },
    true,
  );
  return {
    bitmap,
    ctx: Object.assign(ctx, { beginPlaybackCacheWarm }),
    encoder,
    video,
  };
}

describe("viewer playback video cache", () => {
  beforeEach(() => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:playback-cache");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("encodes canonical full-quality frames and switches to cached playback", async () => {
    const { bitmap, ctx, encoder, video } = createContext();

    await expect(
      capturePlaybackVideoCacheFrame(ctx, {
        fps: 10,
        result: { bitmap, presented: false },
        time: 0,
      }),
    ).resolves.toMatchObject({ finished: false, time: 0.1 });
    expect(encoder.addFrame).toHaveBeenCalledWith(bitmap, 0, 0.1, true);

    await expect(
      capturePlaybackVideoCacheFrame(ctx, {
        fps: 10,
        result: { bitmap, presented: false },
        time: 0.1,
      }),
    ).resolves.toMatchObject({ finished: true, prepared: true, time: 0 });

    expect(encoder.finalize).toHaveBeenCalledOnce();
    expect(ctx.state.previewVideoCache.ready).toBe(true);
    expect(ctx.state.previewVideoCache.playbackActive).toBe(true);
    expect(ctx.state.previewFrameCacheComplete).toBe(true);
    expect(ctx.state.previewFrameCacheEntries).toBe(1);
    expect(ctx.state.previewFrameCacheStorage).toBe("video");
    expect(video.src).toBe("blob:playback-cache");
    expect(video.hidden).toBe(false);
    expect(ctx.syncPreviewQualityBadge).toHaveBeenCalledWith(1);
  });

  it("encodes a selected range from zero-based video time", async () => {
    const { bitmap, ctx, encoder, video } = createContext();
    Object.assign(ctx.state.previewVideoCache, {
      duration: 3,
      rangeEndFrame: 20,
      rangeEndTime: 2,
      rangeStartFrame: 10,
      rangeStartTime: 1,
      segmentPlan: [
        {
          endFrame: 21,
          endTime: 2,
          index: 0,
          startFrame: 10,
          startTime: 1,
        },
      ],
    });
    beginPreviewCacheWarm(
      ctx.state,
      {
        currentTime: 1,
        duration: 3,
        fps: 10,
        range: { end: 2, start: 1 },
      },
      true,
    );

    await capturePlaybackVideoCacheFrame(ctx, {
      fps: 10,
      result: { bitmap, presented: false },
      time: 1,
    });

    expect(encoder.addFrame).toHaveBeenCalledWith(bitmap, 0, 0.1, true);
    ctx.state.previewVideoCache.playbackActive = true;
    ctx.state.previewVideoCache.ready = true;
    await video.play();
    expect(syncPlaybackVideoCache(ctx, 1.5)).toBe(true);
    expect(video.currentTime).toBe(0.5);
  });

  it("keeps a completed cache ready when preparation finishes while paused", async () => {
    const { bitmap, ctx, encoder, video } = createContext();

    await capturePlaybackVideoCacheFrame(ctx, {
      fps: 10,
      result: { bitmap, presented: false },
      time: 0,
    });
    ctx.state.playing = false;

    await expect(
      capturePlaybackVideoCacheFrame(ctx, {
        fps: 10,
        result: { bitmap, presented: false },
        time: 0.1,
      }),
    ).resolves.toMatchObject({ finished: true, prepared: true, time: 0 });

    expect(encoder.finalize).toHaveBeenCalledOnce();
    expect(ctx.state.previewVideoCache.ready).toBe(true);
    expect(ctx.state.previewVideoCache.playbackActive).toBe(false);
    expect(video.hidden).toBe(true);
    expect(video.play).not.toHaveBeenCalled();
    expect(ctx.syncPreviewQualityBadge).toHaveBeenCalledWith(1);
  });

  it("resumes a matching in-progress recording without rebuilding it", async () => {
    const { ctx, encoder } = createContext();
    const template = {
      duration: 2,
      effectId: "heavy-preview",
      id: "heavy-preview",
      kind: "composition",
    };
    prepareCacheModel(ctx, template, 30);
    attachDirectPresentation(ctx, "heavy-preview");

    ctx.state.previewVideoCache.duration = 2;
    ctx.state.previewVideoCache.fps = 30;
    ctx.state.previewVideoCache.key = createPlaybackVideoCacheKey(
      ctx,
      template,
      30,
      2,
    );

    await expect(beginPlaybackVideoCache(ctx)).resolves.toBe("recording");

    expect(ctx.state.previewVideoCache.encoder).toBe(encoder);
    expect(ctx.state.previewVideoCache.recording).toBe(true);
    expect(encoder.cancel).not.toHaveBeenCalled();
  });

  it("coalesces callers while the same video preparation is pending", () => {
    const { ctx } = createContext();
    const pending = new Promise<"recording">(() => undefined);
    ctx.state.previewVideoCache.preparePromise = pending;

    expect(beginPlaybackVideoCache(ctx)).toBe(pending);
  });

  it("uses video as the playback surface without scheduling live rendering", async () => {
    const { ctx, video } = createContext();
    ctx.state.previewVideoCache.playbackActive = true;
    ctx.state.previewVideoCache.ready = true;
    await video.play();

    expect(syncPlaybackVideoCache(ctx, 0.5)).toBe(true);
    expect(video.hidden).toBe(false);
    expect(ctx.refs.fastPreviewCanvas.hidden).toBe(true);
    expect(ctx.refs.directPreviewCanvas.hidden).toBe(true);
  });

  it("revokes an obsolete cache before awaiting encoder cancellation", async () => {
    const { ctx, encoder, video } = createContext();
    ctx.state.previewVideoCache.url = "blob:old-cache";

    await invalidatePlaybackVideoCache(ctx);

    expect(encoder.cancel).toHaveBeenCalledOnce();
    expect(vi.spyOn(URL, "revokeObjectURL")).toHaveBeenCalledWith(
      "blob:old-cache",
    );
    expect(ctx.state.previewVideoCache.ready).toBe(false);
    expect(ctx.state.previewVideoCache.recording).toBe(false);
    expect(video.hidden).toBe(true);
  });

  it("discards a finalized segment after its cache generation was invalidated", async () => {
    const { bitmap, ctx, encoder, video } = createContext();
    let finish!: (blob: Blob) => void;
    let started!: () => void;
    const finalizing = new Promise<Blob>((resolve) => {
      finish = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    encoder.finalize.mockImplementationOnce(() => {
      started();
      return finalizing;
    });
    await capturePlaybackVideoCacheFrame(ctx, {
      fps: 10,
      result: { bitmap },
      time: 0,
    });
    const pending = capturePlaybackVideoCacheFrame(ctx, {
      fps: 10,
      result: { bitmap },
      time: 0.1,
    });
    await entered;
    await invalidatePlaybackVideoCache(ctx);
    ctx.state.previewVideoCache.key = "newer-cache";
    finish(new Blob(["obsolete-video"]));
    await expect(pending).resolves.toMatchObject({
      cancelled: true,
      captured: true,
    });
    expect(ctx.state.previewVideoCache.key).toBe("newer-cache");
    expect(ctx.state.previewVideoCache.ready).toBe(false);
    expect(vi.spyOn(URL, "createObjectURL")).not.toHaveBeenCalled();
    expect(video.play).not.toHaveBeenCalled();
  });

  it("continues with the exact frame cache when video encoding fails", async () => {
    const { bitmap, ctx, encoder } = createContext();
    encoder.addFrame.mockRejectedValueOnce(new Error("encoder failed"));

    await expect(
      capturePlaybackVideoCacheFrame(ctx, {
        fps: 10,
        result: { bitmap },
        time: 0,
      }),
    ).resolves.toEqual({ failed: true });

    expect(ctx.state.previewVideoCache.error).toBeNull();
    expect(ctx.state.previewVideoCache.fallbackKey).toBe("cache-key");
    expect(ctx.state.previewVideoCache.recording).toBe(false);
    expect(ctx.state.previewCacheWarmActive).toBe(true);
    expect(ctx.state.previewFrameCacheStorage).toBe("none");
    expect(ctx.beginPlaybackCacheWarm).toHaveBeenCalledWith(true);
  });

  it("does not resume playback when an asynchronous fallback finishes after pause", async () => {
    const { ctx, encoder } = createContext();
    let finishCancellation!: () => void;
    encoder.cancel.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishCancellation = resolve;
      }),
    );

    const fallback = fallBackToExactFrameCache(ctx, "cache-key");
    ctx.state.playing = false;
    finishCancellation();
    await fallback;

    expect(ctx.state.playing).toBe(false);
    expect(ctx.state.previewVideoCache.fallbackKey).toBe("cache-key");
    expect(ctx.beginPlaybackCacheWarm).not.toHaveBeenCalled();
  });

  it("does not let an obsolete fallback overwrite a newer cache generation", async () => {
    const { ctx, encoder } = createContext();
    let finishCancellation!: () => void;
    encoder.cancel.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishCancellation = resolve;
      }),
    );

    const fallback = fallBackToExactFrameCache(ctx, "obsolete-key");
    const newerInvalidation = invalidatePlaybackVideoCache(ctx);
    finishCancellation();
    await Promise.all([fallback, newerInvalidation]);

    expect(ctx.state.previewVideoCache.fallbackKey).toBeNull();
    expect(ctx.beginPlaybackCacheWarm).not.toHaveBeenCalled();
  });

  it("waits for a bitmap when an older direct-presentation frame arrives", async () => {
    const { ctx, encoder } = createContext();

    await expect(
      capturePlaybackVideoCacheFrame(ctx, {
        fps: 10,
        result: { presented: true },
        time: 0,
      }),
    ).resolves.toEqual({ deferred: true });

    expect(encoder.addFrame).not.toHaveBeenCalled();
    expect(ctx.state.previewVideoCache.recording).toBe(true);
    expect(ctx.state.previewCacheWarmActive).toBe(true);
  });

  it("uses the exact frame cache when FPS is too low for ordered video encoding", async () => {
    const template = {
      duration: 1,
      effectId: "slow-preview",
      id: "slow-preview",
      kind: "composition",
    };
    const ctx = createCacheModelContext(template, 1);
    attachDirectPresentation(ctx, "slow-preview");

    await expect(beginPlaybackVideoCache(ctx)).resolves.toBe("unavailable");
  });

  it("clears a stale video cache before low-FPS frame caching starts", async () => {
    const { ctx, encoder } = createContext();
    const template = {
      duration: 1,
      effectId: "slow-preview",
      id: "slow-preview",
      kind: "composition",
    };
    prepareCacheModel(ctx, template, 1);
    attachDirectPresentation(ctx, "slow-preview");

    ctx.state.previewFrameCacheComplete = true;
    ctx.state.previewVideoCache.key = "stale-key";

    await expect(beginPlaybackVideoCache(ctx)).resolves.toBe("unavailable");

    expect(encoder.cancel).toHaveBeenCalledOnce();
    expect(ctx.state.previewVideoCache.key).toBeNull();
    expect(ctx.state.previewFrameCacheComplete).toBe(false);
  });

  it("invalidates cached playback only when render-affecting input changes", () => {
    const template = { duration: 2, id: "demo" };
    const ctx = createCacheModelContext(template, 30);
    ctx.state.controls = { speed: 1 };
    ctx.state.previewVideoCache.key = createPlaybackVideoCacheKey(
      ctx,
      template,
      30,
      2,
    );

    expect(isPlaybackVideoCacheCurrent(ctx)).toBe(true);
    ctx.state.previewRasterWidth = 640;
    ctx.state.previewRasterHeight = 360;
    expect(isPlaybackVideoCacheCurrent(ctx)).toBe(false);
    ctx.state.previewRasterWidth = 1280;
    ctx.state.previewRasterHeight = 720;
    ctx.state.controls = { speed: 2 };
    expect(isPlaybackVideoCacheCurrent(ctx)).toBe(false);
    ctx.state.controls = { speed: 1 };
    ctx.state.playbackRange = { end: 1.5, start: 0.5 };
    expect(isPlaybackVideoCacheCurrent(ctx)).toBe(false);
  });

  it("ignores assets outside the selected template render scope", () => {
    const template = {
      duration: 2,
      assets: ["used"],
      id: "demo",
      moduleId: "module",
    };
    const ctx = createCacheModelContext(template, 30);
    ctx.state.assets = new Map([
      ["used", { dataUrl: "data:used-a", id: "used" }],
      ["unused", { dataUrl: "data:unused-a", id: "unused" }],
    ]);
    addModule(ctx);
    const initial = createPlaybackVideoCacheKey(ctx, template, 30, 2);

    ctx.state.assets.set("unused", {
      dataUrl: "data:unused-b",
      id: "unused",
    });
    expect(createPlaybackVideoCacheKey(ctx, template, 30, 2)).toBe(initial);
    ctx.state.assets.set("used", { dataUrl: "data:used-b", id: "used" });
    expect(createPlaybackVideoCacheKey(ctx, template, 30, 2)).not.toBe(initial);
  });

  it("invalidates only segments influenced by a changed keyframe", () => {
    const template = {
      duration: 5,
      assets: [],
      id: "demo",
      moduleId: "module",
      timeline: {
        tracks: [
          {
            id: "opacity",
            keyframes: [0.5, 3.5].map((time) => ({
              id: `opacity-${time}`,
              time,
              value: time,
            })),
          },
        ],
      },
    };
    const ctx = createCacheModelContext(template, 8);
    addModule(ctx);
    const first = { endTime: 2, startTime: 0 };
    const last = { endTime: 5, startTime: 4 };
    const before = {
      content: createPlaybackVideoCacheKey(ctx, template, 8, 5),
      first: createPlaybackVideoCacheSegmentFingerprint(
        ctx,
        template,
        8,
        5,
        first,
      ),
      last: createPlaybackVideoCacheSegmentFingerprint(
        ctx,
        template,
        8,
        5,
        last,
      ),
      storage: createPlaybackVideoCacheStorageKey(ctx, template, 8, 5),
    };

    requiredEntry(
      requiredEntry(template.timeline.tracks, 0).keyframes,
      0,
    ).value = 100;

    expect(
      createPlaybackVideoCacheSegmentFingerprint(ctx, template, 8, 5, first),
    ).not.toBe(before.first);
    expect(
      createPlaybackVideoCacheSegmentFingerprint(ctx, template, 8, 5, last),
    ).toBe(before.last);
    expect(createPlaybackVideoCacheKey(ctx, template, 8, 5)).not.toBe(
      before.content,
    );
    expect(createPlaybackVideoCacheStorageKey(ctx, template, 8, 5)).toBe(
      before.storage,
    );
  });

  it("prefers bounded video storage only for high-resolution compositions", () => {
    const template = {
      duration: 2,
      effectId: "composition",
      id: "composition",
      kind: "composition",
    };
    const ctx = createCacheModelContext(template, 30);
    attachDirectPresentation(ctx, "composition");
    vi.spyOn(ctx, "getPreviewRasterSize").mockReturnValue({
      height: 1440,
      width: 2560,
    });

    expect(shouldPreferPlaybackVideoCache(ctx, template)).toBe(true);
    ctx.getPreviewRasterSize = () => ({ height: 1080, width: 1920 });
    expect(shouldPreferPlaybackVideoCache(ctx, template)).toBe(false);
    ctx.getPreviewRasterSize = () => ({ height: 2160, width: 3840 });
    expect(
      shouldPreferPlaybackVideoCache(ctx, {
        ...template,
        kind: "transitionEffect",
      }),
    ).toBe(false);
  });
});

function prepareCacheModel(
  ctx: ReturnType<typeof createViewerPlaybackFixture>,
  template: EditorTemplateSource,
  fps: number,
) {
  ctx.state.currentTemplate = template;
  ctx.state.previewRasterWidth = 1280;
  ctx.state.previewRasterHeight = 720;
  ctx.state.sandboxRuntimeGeneration = 1;
  ctx.refs.canvas.width = 1280;
  ctx.refs.canvas.height = 720;
  ctx.refs.fpsInput.value = String(fps);
  vi.spyOn(ctx, "getRenderTemplateSnapshot").mockImplementation(() =>
    ctx.getEffectiveTemplate(template),
  );
}
function createCacheModelContext(template: EditorTemplateSource, fps: number) {
  const ctx = createViewerPlaybackFixture();
  prepareCacheModel(ctx, template, fps);
  return ctx;
}
function attachDirectPresentation(
  ctx: ReturnType<typeof createViewerPlaybackFixture>,
  effectId: string,
) {
  ctx.state.directRenderEffectIds = new Set([effectId]);
  ctx.state.directRenderResponsePort = {
    presentationSurfaceAttached: true,
    close: vi.fn<DirectRenderResponsePort["close"]>(),
    postMessage: vi.fn<DirectRenderResponsePort["postMessage"]>(),
  };
}
function addModule(ctx: ReturnType<typeof createViewerPlaybackFixture>) {
  ctx.state.modules.set("module", {
    id: "module",
    path: "effects/module.sniptale-effect.json",
    document: createStarterDocument("module", "standalone"),
  });
  ctx.state.pack = { packId: "pack", version: "1" };
}
