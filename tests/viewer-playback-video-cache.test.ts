import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { normalizeTimeline } from "../src/apps/viewer/editor/model";
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
  const bitmap = { height: 720, width: 1280 };
  const video = {
    addEventListener: vi.fn(),
    currentTime: 0,
    hidden: true,
    load: vi.fn(),
    pause: vi.fn(),
    paused: true,
    play: vi.fn(async () => undefined),
    removeAttribute: vi.fn(),
    src: "",
  };
  const encoder = {
    addFrame: vi.fn(async () => undefined),
    cancel: vi.fn(async () => undefined),
    codec: "avc",
    finalize: vi.fn(async () => new Blob(["cached-video"])),
    mimeType: "video/mp4",
    segmented: true,
  };
  const state = {
    playing: true,
    previewCacheWarmActive: false,
    previewCacheWarmPrepared: false,
    previewCacheWarmRangeEndFrame: 0,
    previewCacheWarmRangeStartFrame: 0,
    previewCacheWarmRenderTime: 0,
    previewCacheWarmScale: 1,
    previewCacheWarmStartTime: 0,
    previewCacheWarmTargetFrames: 0,
    previewCacheWarmVisitedFrames: 0,
    previewFrameCacheBytes: 0,
    previewFrameCacheComplete: false,
    previewFrameCacheEntries: 0,
    previewFrameCacheFrames: 0,
    previewFrameCacheStorage: "video-recording",
    previewVideoCache: {
      bytes: 0,
      cancelPromise: null,
      codec: "avc",
      duration: 0.1,
      encoder,
      error: null,
      fallbackKey: null,
      finalizing: false,
      fps: 10,
      generation: 1,
      key: "cache-key",
      lastPlaybackTime: 0,
      originalTime: 0,
      playbackActive: false,
      preparing: false,
      ready: false,
      recording: true,
      segmentBlobs: [],
      segmentIndex: 0,
      segmentPlan: [
        {
          endFrame: 2,
          endTime: 0.1,
          index: 0,
          startFrame: 0,
          startTime: 0,
        },
      ],
      url: null,
    },
  };
  const ctx = {
    formatSeconds: (time: number) => `${time}s`,
    isPreviewFullscreenActive: () => false,
    lastPlaybackAudioTs: 0,
    refs: {
      cachedPreviewVideo: video,
      directPreviewCanvas: { hidden: false },
      fastPreviewCanvas: { hidden: false },
      fullscreenTimeOutput: null,
      fullscreenTimeSlider: null,
      timeOutput: { textContent: "" },
      timeSlider: { value: "0" },
    },
    state,
    syncPreviewAudio: vi.fn(),
    syncPreviewQualityBadge: vi.fn(),
    updateTimelinePlayhead: vi.fn(),
  } as any;
  ctx.beginPlaybackCacheWarm = vi.fn(() =>
    beginPreviewCacheWarm(
      state,
      { currentTime: 0, duration: 0.1, fps: 10 },
      true,
    ),
  );
  beginPreviewCacheWarm(
    state,
    { currentTime: 0, duration: 0.1, fps: 10 },
    true,
  );
  return { bitmap, ctx, encoder, video };
}

describe("viewer playback video cache", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:playback-cache"),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
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
    video.paused = false;
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
      effectId: "heavy-preview",
      id: "heavy-preview",
      kind: "composition",
    };
    Object.assign(ctx, {
      getEffectiveDuration: () => 2,
      getRenderTemplateSnapshot: () => template,
    });
    Object.assign(ctx.refs, {
      canvas: { height: 720, width: 1280 },
      fpsInput: { value: "30" },
    });
    Object.assign(ctx.state, {
      assets: new Map(),
      controls: {},
      currentTemplate: template,
      directRenderEffectIds: new Set(["heavy-preview"]),
      directRenderResponsePort: { presentationSurfaceAttached: true },
      sandboxRuntimeGeneration: 1,
    });
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

  it("uses video as the playback surface without scheduling live rendering", () => {
    const { ctx, video } = createContext();
    ctx.state.previewVideoCache.playbackActive = true;
    ctx.state.previewVideoCache.ready = true;
    video.paused = false;

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
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:old-cache");
    expect(ctx.state.previewVideoCache.ready).toBe(false);
    expect(ctx.state.previewVideoCache.recording).toBe(false);
    expect(video.hidden).toBe(true);
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
      effectId: "slow-preview",
      id: "slow-preview",
      kind: "composition",
    };
    const ctx = {
      getEffectiveDuration: () => 1,
      getRenderTemplateSnapshot: () => template,
      refs: {
        canvas: { height: 720, width: 1280 },
        fpsInput: { value: "1" },
      },
      state: {
        assets: new Map(),
        controls: {},
        currentTemplate: template,
        directRenderEffectIds: new Set(["slow-preview"]),
        directRenderResponsePort: { presentationSurfaceAttached: true },
        previewVideoCache: {
          fallbackKey: null,
          key: null,
          ready: false,
        },
        sandboxRuntimeGeneration: 1,
      },
    } as any;

    await expect(beginPlaybackVideoCache(ctx)).resolves.toBe("unavailable");
  });

  it("clears a stale video cache before low-FPS frame caching starts", async () => {
    const { ctx, encoder } = createContext();
    const template = {
      effectId: "slow-preview",
      id: "slow-preview",
      kind: "composition",
    };
    Object.assign(ctx, {
      getEffectiveDuration: () => 1,
      getRenderTemplateSnapshot: () => template,
    });
    Object.assign(ctx.refs, {
      canvas: { height: 720, width: 1280 },
      fpsInput: { value: "1" },
    });
    Object.assign(ctx.state, {
      assets: new Map(),
      controls: {},
      currentTemplate: template,
      directRenderEffectIds: new Set(["slow-preview"]),
      directRenderResponsePort: { presentationSurfaceAttached: true },
      previewFrameCacheComplete: true,
      sandboxRuntimeGeneration: 1,
    });
    ctx.state.previewVideoCache.key = "stale-key";

    await expect(beginPlaybackVideoCache(ctx)).resolves.toBe("unavailable");

    expect(encoder.cancel).toHaveBeenCalledOnce();
    expect(ctx.state.previewVideoCache.key).toBeNull();
    expect(ctx.state.previewFrameCacheComplete).toBe(false);
  });

  it("invalidates cached playback only when render-affecting input changes", () => {
    const template = { id: "demo" };
    const ctx = {
      getEffectiveDuration: () => 2,
      getRenderTemplateSnapshot: () => ({ id: "demo", layers: [] }),
      refs: {
        canvas: { height: 720, width: 1280 },
        fpsInput: { value: "30" },
      },
      state: {
        assets: new Map(),
        controls: { speed: 1 },
        currentTemplate: template,
        previewRasterHeight: 720,
        previewRasterWidth: 1280,
        previewVideoCache: { key: null },
        sandboxRuntimeGeneration: 1,
      },
    } as any;
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
    const template = { assets: ["used"], id: "demo", moduleId: "module" };
    const ctx = {
      getRenderTemplateSnapshot: () => template,
      refs: { canvas: { height: 720, width: 1280 } },
      state: {
        assets: new Map([
          ["used", { dataUrl: "data:used-a", id: "used" }],
          ["unused", { dataUrl: "data:unused-a", id: "unused" }],
        ]),
        controls: {},
        modules: new Map([
          ["module", { id: "module", source: "renderer-source" }],
        ]),
        pack: { packId: "pack", version: "1" },
        playbackRange: null,
        previewRasterHeight: 720,
        previewRasterWidth: 1280,
      },
    } as any;
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
      assets: [],
      id: "demo",
      moduleId: "module",
      timeline: {
        tracks: [
          {
            id: "opacity",
            keyframes: [0.5, 3.5].map((time) => ({
              time,
              value: time,
            })),
          },
        ],
      },
    };
    const ctx = {
      deps: { normalizeTimeline },
      getRenderTemplateSnapshot: () => structuredClone(template),
      refs: { canvas: { height: 720, width: 1280 } },
      state: {
        assets: new Map(),
        controls: {},
        modules: new Map([
          ["module", { id: "module", source: "renderer-source" }],
        ]),
        pack: { packId: "pack", version: "1" },
        playbackRange: null,
        previewRasterHeight: 720,
        previewRasterWidth: 1280,
      },
    } as any;
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

    template.timeline.tracks[0].keyframes[0].value = 100;

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
      effectId: "composition",
      id: "composition",
      kind: "composition",
    };
    const ctx = {
      getPreviewRasterSize: () => ({ height: 1440, width: 2560 }),
      state: {
        directRenderEffectIds: new Set(["composition"]),
        directRenderResponsePort: { presentationSurfaceAttached: true },
      },
    } as any;

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
