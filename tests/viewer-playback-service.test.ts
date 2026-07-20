import { describe, expect, it, vi } from "vitest";

import {
  advancePlaybackRenderAnchorMs,
  isPlaybackRenderDue,
  resolvePlaybackRenderDelayMs,
  resolvePlaybackRenderAnchorMs,
  resolvePlaybackRenderIntervalMs,
  resolvePlaybackSchedulingLatencyMs,
  resolvePlaybackUiIntervalMs,
} from "../src/apps/viewer/playback/cadence";
import {
  installPlaybackServiceOwner,
  schedulePlaybackTick,
} from "../src/apps/viewer/playback/service";

describe("viewer playback render cadence", () => {
  it("keeps the requested cadence for inexpensive frames", () => {
    expect(resolvePlaybackRenderIntervalMs(30)).toBeCloseTo(1000 / 30);
    expect(resolvePlaybackRenderIntervalMs(60)).toBeCloseTo(1000 / 60);
  });

  it("adds bounded UI headroom only when preview latency exceeds the frame budget", () => {
    expect(resolvePlaybackRenderIntervalMs(24, 10)).toBeCloseTo(1000 / 24);
    expect(resolvePlaybackRenderIntervalMs(30, 25)).toBeCloseTo(1000 / 30);
    expect(resolvePlaybackRenderIntervalMs(60, 40)).toBeCloseTo(46);
    expect(resolvePlaybackRenderIntervalMs(15, 80)).toBeCloseTo(1000 / 15);
  });

  it("paces lossless cache preparation from end-to-end latency with GPU breathing room", () => {
    expect(resolvePlaybackRenderIntervalMs(60, 40, true)).toBeCloseTo(48);
    expect(resolvePlaybackRenderIntervalMs(30, 100, true)).toBeCloseTo(114);
  });

  it("schedules direct worker presentation from render cost, not delayed main-thread acknowledgement", () => {
    const directContext = {
      state: {
        appliedPreviewScale: 0.125,
        averagePreviewLatencyMs: 52,
        averageRenderMs: 7,
        lastPreviewLatencyMs: 90,
        currentTemplate: { effectId: "complex", kind: "composition" },
        directLiveRenderKeys: new Set(["complex:1280x720"]),
        directRenderEffectIds: new Set(["complex"]),
        directRenderResponsePort: { presentationSurfaceAttached: true },
        previewCacheEnabled: true,
        previewRasterHeight: 720,
        previewRasterWidth: 1280,
      },
    } as any;
    expect(resolvePlaybackSchedulingLatencyMs(directContext)).toBe(52);

    directContext.state.previewCacheWarmActive = true;
    expect(resolvePlaybackSchedulingLatencyMs(directContext)).toBe(90);
    directContext.state.previewFrameCacheComplete = true;
    expect(resolvePlaybackSchedulingLatencyMs(directContext)).toBe(90);
    directContext.state.previewFrameCacheComplete = false;
    directContext.state.previewCacheWarmActive = false;

    directContext.state.previewFrameCacheComplete = true;
    expect(resolvePlaybackSchedulingLatencyMs(directContext)).toBe(0);
    directContext.state.previewFrameCacheComplete = false;

    directContext.state.previewCacheEnabled = false;
    expect(resolvePlaybackSchedulingLatencyMs(directContext)).toBe(7);
    directContext.state.previewCacheEnabled = true;

    directContext.state.currentTemplate.kind = "graphic";
    expect(resolvePlaybackSchedulingLatencyMs(directContext)).toBe(52);
    directContext.state.currentTemplate.kind = "composition";
    directContext.state.directRenderResponsePort.presentationSurfaceAttached = false;
    expect(resolvePlaybackSchedulingLatencyMs(directContext)).toBe(52);
  });

  it("starts close deadlines early enough to absorb throttled timer jitter", () => {
    const interval = 1000 / 30;
    expect(isPlaybackRenderDue(1030.5, 1000, interval)).toBe(true);
    expect(isPlaybackRenderDue(1029.5, 1000, interval)).toBe(false);
  });

  it("schedules the remaining frame deadline instead of waiting for another rAF", () => {
    const interval = 1000 / 30;
    expect(resolvePlaybackRenderDelayMs(1030, 1000, interval)).toBeCloseTo(
      interval - 33,
    );
    expect(resolvePlaybackRenderDelayMs(1030.5, 1000, interval)).toBe(0);
    expect(resolvePlaybackRenderDelayMs(1030, 0, interval)).toBe(0);
  });

  it("keeps the deadline phase for normal callback jitter", () => {
    const interval = 1000 / 30;
    expect(advancePlaybackRenderAnchorMs(1038, 1000, interval)).toBeCloseTo(
      1000 + interval,
    );
    expect(advancePlaybackRenderAnchorMs(1038, 0, interval)).toBe(1038);
  });

  it("does not burst a catch-up frame after a late callback", () => {
    const interval = 1000 / 30;
    expect(advancePlaybackRenderAnchorMs(1050, 1000, interval)).toBe(1050);
    expect(advancePlaybackRenderAnchorMs(1080, 1000, interval)).toBe(1080);
  });

  it("paces the next direct frame from its local presentation time", () => {
    const interval = 1000 / 30;
    expect(
      resolvePlaybackRenderAnchorMs(1000, 1024, interval) + interval,
    ).toBeCloseTo(1000 + interval);
    expect(resolvePlaybackRenderAnchorMs(1040, 1024, interval)).toBe(1040);
    expect(resolvePlaybackRenderAnchorMs(1000, null, interval)).toBe(1000);
    const sixtyFpsInterval = 1000 / 60;
    expect(
      resolvePlaybackRenderAnchorMs(1000, 1024, sixtyFpsInterval) +
        sixtyFpsInterval,
    ).toBeCloseTo(1026.5);
  });

  it("updates editor chrome no faster than 30 fps or the render cadence", () => {
    expect(resolvePlaybackUiIntervalMs(1000 / 60)).toBeCloseTo(1000 / 30);
    expect(resolvePlaybackUiIntervalMs(48)).toBe(48);
    expect(resolvePlaybackUiIntervalMs(900)).toBe(100);
  });

  it("reduces editor chrome cadence when the main thread is missing frames", () => {
    expect(resolvePlaybackUiIntervalMs(1000 / 30, 19)).toBeCloseTo(1000 / 30);
    expect(resolvePlaybackUiIntervalMs(1000 / 30, 22)).toBe(50);
    expect(resolvePlaybackUiIntervalMs(1000 / 30, 32)).toBeCloseTo(1000 / 15);
  });

  it("updates complex editor chrome at 20 fps without reducing render cadence", () => {
    expect(resolvePlaybackUiIntervalMs(1000 / 30, 16, 15)).toBeCloseTo(
      1000 / 30,
    );
    expect(resolvePlaybackUiIntervalMs(1000 / 30, 16, 16)).toBe(50);
  });

  it("keeps at most one playback animation callback pending", () => {
    const callbacks: FrameRequestCallback[] = [];
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    const playbackTick = vi.fn();
    const ctx = {
      playbackAnimationFrame: null,
      playbackTick,
    } as any;
    vi.stubGlobal("window", { requestAnimationFrame });
    try {
      schedulePlaybackTick(ctx);
      schedulePlaybackTick(ctx);
      expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

      callbacks[0](42);
      expect(ctx.playbackAnimationFrame).toBeNull();
      expect(playbackTick).toHaveBeenCalledWith(42);

      schedulePlaybackTick(ctx);
      expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps the timeline frozen while video cache storage is restoring", () => {
    const requestAnimationFrame = vi.fn(() => 1);
    vi.stubGlobal("window", { requestAnimationFrame });
    const renderCurrentFrame = vi.fn();
    const syncPreviewAudio = vi.fn();
    const ctx = {
      formatSeconds: (time: number) => `${time.toFixed(3)}s`,
      getEffectiveDuration: () => 5,
      isPreviewFullscreenActive: () => false,
      lastPlaybackAudioTs: 0,
      lastPlaybackRenderTs: 0,
      lastPlaybackTs: 1000,
      lastPlaybackUiTs: 0,
      playbackAnimationFrame: null,
      playbackRenderTimer: null,
      refs: {
        fpsInput: { value: "30" },
        fullscreenTimeOutput: null,
        fullscreenTimeSlider: null,
        timeOutput: { textContent: "" },
        timeSlider: { value: "1" },
      },
      renderCurrentFrame,
      state: {
        averagePlaybackTickMs: 0,
        averagePreviewLatencyMs: 0,
        averageRenderMs: 0,
        currentTemplate: {
          effectId: "heavy",
          id: "heavy",
          kind: "composition",
          layers: [],
          timeline: { tracks: [] },
        },
        directRenderEffectIds: new Set(),
        lastDirectPresentationLocalAtMs: null,
        loopPlayback: false,
        playbackRange: null,
        playbackRun: {
          generation: 1,
          mode: "cache",
          phase: "preparing-video-cache",
          templateId: "heavy",
        },
        playing: true,
        previewCacheEnabled: true,
        previewCacheWarmActive: false,
        previewFrameCacheComplete: false,
        previewVideoCache: {
          playbackActive: false,
          preparePromise: Promise.resolve("recording"),
        },
        renderInFlight: false,
      },
      syncPlaybackVideoCache: vi.fn(() => false),
      syncPreviewAudio,
      updateTimelinePlayhead: vi.fn(),
    } as any;
    installPlaybackServiceOwner(ctx);

    ctx.playbackTick(1100);

    expect(ctx.refs.timeSlider.value).toBe("1");
    expect(renderCurrentFrame).not.toHaveBeenCalled();
    expect(syncPreviewAudio).not.toHaveBeenCalled();
    expect(requestAnimationFrame).toHaveBeenCalledOnce();
  });

  it("does not refine a different template after playback stops", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", {
      clearTimeout: globalThis.clearTimeout,
      setTimeout: globalThis.setTimeout,
    });
    const refinePreviewAtFullQuality = vi.fn();
    const ctx = {
      lastPlaybackAudioTs: 0,
      lastPlaybackRenderTs: 0,
      lastPlaybackTs: 0,
      lastPlaybackUiTs: 0,
      playbackAnimationFrame: null,
      playbackRenderTimer: null,
      refinePreviewAtFullQuality,
      renderCurrentFrame: vi.fn().mockResolvedValue(undefined),
      state: {
        currentTemplate: { id: "paused-template" },
        playing: true,
      },
      stopPreviewAudio: vi.fn(),
      syncPlaybackButtons: vi.fn(),
    } as any;
    installPlaybackServiceOwner(ctx);
    try {
      ctx.togglePlayback();
      await Promise.resolve();
      ctx.state.currentTemplate = { id: "next-template" };
      await vi.advanceTimersByTimeAsync(120);
      expect(refinePreviewAtFullQuality).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it("starts a new run without inheriting elapsed time from the previous playback", () => {
    vi.stubGlobal("window", { requestAnimationFrame: vi.fn(() => 1) });
    const ctx = {
      lastPlaybackAudioTs: 0,
      lastPlaybackRenderTs: 900,
      lastPlaybackTs: 800,
      lastPlaybackUiTs: 700,
      playbackAnimationFrame: null,
      playbackRenderTimer: null,
      refs: { timeSlider: { value: "0" } },
      schedulePlaybackTick: vi.fn(),
      state: {
        currentTemplate: { id: "template" },
        playing: false,
        previewCacheEnabled: false,
      },
      syncPlaybackButtons: vi.fn(),
      syncPreviewAudio: vi.fn(),
    } as any;
    installPlaybackServiceOwner(ctx);
    try {
      ctx.startPlayback();

      expect(ctx.lastPlaybackTs).toBe(0);
      expect(ctx.lastPlaybackRenderTs).toBe(0);
      expect(ctx.state.playing).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not start playback in the middle of an active canvas gesture", () => {
    const ctx = {
      lastPlaybackAudioTs: 0,
      lastPlaybackRenderTs: 0,
      lastPlaybackTs: 0,
      lastPlaybackUiTs: 0,
      playbackAnimationFrame: null,
      playbackRenderTimer: null,
      refs: {
        playButton: { disabled: false },
        timeSlider: { value: "0" },
      },
      state: {
        canvasTransformDragActive: true,
        currentTemplate: { id: "template" },
        playing: false,
        previewCacheEnabled: false,
      },
      syncPlaybackButtons: vi.fn(),
    } as any;
    installPlaybackServiceOwner(ctx);

    ctx.startPlayback();

    expect(ctx.state.playing).toBe(false);
    expect(ctx.syncPlaybackButtons).not.toHaveBeenCalled();
  });

  it("does not start playback in the middle of an active timeline gesture", () => {
    const ctx = {
      lastPlaybackAudioTs: 0,
      lastPlaybackRenderTs: 0,
      lastPlaybackTs: 0,
      lastPlaybackUiTs: 0,
      playbackAnimationFrame: null,
      playbackRenderTimer: null,
      refs: {
        playButton: { disabled: false },
        timeSlider: { value: "0" },
      },
      state: {
        currentTemplate: { id: "template" },
        playing: false,
        previewCacheEnabled: false,
        timelineDragActive: true,
      },
      syncPlaybackButtons: vi.fn(),
    } as any;
    installPlaybackServiceOwner(ctx);

    ctx.startPlayback();

    expect(ctx.state.playing).toBe(false);
    expect(ctx.syncPlaybackButtons).not.toHaveBeenCalled();
  });

  it("pauses an in-progress cache build without discarding its frames", () => {
    const stopPlaybackVideoCache = vi.fn();
    const renderCurrentFrame = vi.fn().mockResolvedValue(undefined);
    const syncPreviewQualityBadge = vi.fn();
    const ctx = {
      lastPlaybackAudioTs: 0,
      lastPlaybackRenderTs: 0,
      lastPlaybackTs: 0,
      lastPlaybackUiTs: 0,
      playbackAnimationFrame: null,
      playbackRenderTimer: null,
      renderCurrentFrame,
      state: {
        appliedPreviewScale: 1,
        currentTemplate: { id: "heavy-template" },
        playing: true,
        previewCacheEnabled: true,
        previewCacheWarmActive: true,
        previewCacheWarmScale: 1,
        previewCacheWarmVisitedFrames: 12,
        previewVideoCache: { finalizing: false, recording: true },
      },
      stopPlaybackVideoCache,
      stopPreviewAudio: vi.fn(),
      syncPlaybackButtons: vi.fn(),
      syncPreviewQualityBadge,
    } as any;
    installPlaybackServiceOwner(ctx);

    ctx.togglePlayback();

    expect(ctx.state.playing).toBe(false);
    expect(stopPlaybackVideoCache).toHaveBeenCalledWith(false);
    expect(ctx.state.previewCacheWarmActive).toBe(true);
    expect(ctx.state.previewCacheWarmVisitedFrames).toBe(12);
    expect(ctx.state.playbackRun.phase).toBe("paused-preparation");
    expect(renderCurrentFrame).not.toHaveBeenCalled();
    expect(syncPreviewQualityBadge).toHaveBeenCalledWith(1);
  });

  it("cancels preparation explicitly when playback yields resources to export", () => {
    const stopPlaybackVideoCache = vi.fn();
    const ctx = {
      lastPlaybackAudioTs: 0,
      lastPlaybackRenderTs: 0,
      lastPlaybackTs: 0,
      lastPlaybackUiTs: 0,
      playbackAnimationFrame: null,
      playbackRenderTimer: null,
      state: {
        currentTemplate: { id: "heavy-template" },
        playing: true,
        previewCacheEnabled: true,
        previewCacheWarmActive: true,
        previewVideoCache: { recording: true },
      },
      stopPlaybackVideoCache,
      stopPreviewAudio: vi.fn(),
      syncPlaybackButtons: vi.fn(),
    } as any;
    installPlaybackServiceOwner(ctx);

    expect(
      ctx.pausePlayback({
        preservePreparation: false,
        renderCurrentFrame: false,
      }),
    ).toBe(false);

    expect(ctx.state.playing).toBe(false);
    expect(ctx.state.playbackRun.phase).toBe("idle");
    expect(ctx.state.previewCacheWarmActive).toBe(false);
    expect(stopPlaybackVideoCache).toHaveBeenCalledWith(true);
  });
});
