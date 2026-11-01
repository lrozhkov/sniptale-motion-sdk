import { createViewerPlaybackFixture } from "./helpers/viewer-playback-fixture.js";
import { createNativeButtonFixture } from "./helpers/native-button-fixture.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  initializePlaybackCachePreference,
  setPlaybackCacheEnabled,
  syncPlaybackCacheButton,
} from "../src/apps/viewer/playback/cache-toggle";
import { beginPlaybackRun } from "../src/apps/viewer/playback/run";

function createContext() {
  const ctx = createViewerPlaybackFixture();
  const previewCacheButton = createNativeButtonFixture();
  const previewLiveModeButton = createNativeButtonFixture();
  ctx.refs.timeSlider.value = "1.5";
  ctx.state.playing = true;
  ctx.state.previewCacheEnabled = true;
  ctx.state.previewCacheWarmCapacityLimited = true;
  ctx.state.previewVideoCache.playbackActive = true;
  ctx.state.previewVideoCache.ready = true;
  return Object.assign(ctx, {
    refs: Object.assign(ctx.refs, {
      previewCacheButton,
      previewLiveModeButton,
    }),
  });
}

describe("viewer playback cache toggle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("switches cached playback to full-quality live rendering without deleting a ready cache", () => {
    const ctx = createContext();

    setPlaybackCacheEnabled(ctx, false);

    expect(ctx.state.previewCacheEnabled).toBe(false);
    expect(ctx.state.previewCacheWarmCapacityLimited).toBe(false);
    expect(ctx.stopPlaybackVideoCache).toHaveBeenCalledWith(false);
    expect(ctx.invalidatePlaybackVideoCache).not.toHaveBeenCalled();
    expect(ctx.syncPreviewAudio).toHaveBeenCalledWith(1.5);
    expect(ctx.renderCurrentFrame).toHaveBeenCalledOnce();
    expect(ctx.schedulePlaybackTick).toHaveBeenCalledOnce();
  });

  it("cancels an incomplete cache build when disabled", () => {
    const ctx = createContext();
    ctx.state.previewVideoCache.playbackActive = false;
    ctx.state.previewVideoCache.recording = true;

    setPlaybackCacheEnabled(ctx, false);

    expect(ctx.invalidatePlaybackVideoCache).toHaveBeenCalledOnce();
    expect(ctx.syncPlaybackButtons).toHaveBeenCalledOnce();
  });

  it("starts cache preparation when Cache is chosen during live playback", () => {
    const ctx = createContext();
    ctx.state.previewCacheEnabled = false;
    setPlaybackCacheEnabled(ctx, true);

    expect(ctx.state.previewCacheEnabled).toBe(true);
    expect(ctx.beginPlaybackVideoCache).not.toHaveBeenCalled();
    expect(ctx.state.previewCacheWarmActive).toBe(true);
  });

  it("does not restart the active preview mode", () => {
    const ctx = createContext();

    setPlaybackCacheEnabled(ctx, true);

    expect(ctx.beginPlaybackVideoCache).not.toHaveBeenCalled();
    expect(ctx.renderCurrentFrame).not.toHaveBeenCalled();
  });

  it("updates the compact timeline toggle with state and accessible text", () => {
    const ctx = createContext();

    syncPlaybackCacheButton(ctx);

    expect(ctx.refs.previewCacheButton.classList.toggle).toHaveBeenCalledWith(
      "building",
      false,
    );
    expect(ctx.refs.previewCacheButton.setAttribute).toHaveBeenCalledWith(
      "aria-pressed",
      "true",
    );
    expect(ctx.refs.previewLiveModeButton.setAttribute).toHaveBeenCalledWith(
      "aria-pressed",
      "false",
    );
    expect(ctx.refs.previewCacheButton.title).toBe(
      "Cache + preview mode: prepare full-quality playback once and defer heavy canvas renders until the interaction pauses.",
    );
  });

  it("exposes preparation progress on the timeline cache control", () => {
    const ctx = createContext();
    ctx.state.previewCacheWarmActive = true;
    ctx.state.previewCacheWarmTargetFrames = 100;
    ctx.state.previewCacheWarmVisitedFrames = 37;

    syncPlaybackCacheButton(ctx);

    expect(ctx.refs.previewCacheButton.setAttribute).toHaveBeenCalledWith(
      "aria-label",
      "Preparing preview 37%. Playback starts automatically when ready; choose Live to start now.",
    );
    expect(ctx.refs.previewCacheButton.classList.toggle).toHaveBeenCalledWith(
      "building",
      true,
    );
  });

  it("explains when an update reuses saved video segments", () => {
    const ctx = createContext();
    ctx.state.previewCacheWarmActive = true;
    ctx.state.previewCacheWarmTargetFrames = 32;
    ctx.state.previewCacheWarmVisitedFrames = 8;
    Object.assign(ctx.state.previewVideoCache, {
      recording: true,
      restoredSegmentCount: 1,
      segmentPlan: Array.from({ length: 3 }, (_, index) => ({
        index,
        startFrame: index * 10,
        endFrame: (index + 1) * 10,
        startTime: index,
        endTime: index + 1,
      })),
    });

    syncPlaybackCacheButton(ctx);

    expect(ctx.refs.previewCacheButton.setAttribute).toHaveBeenCalledWith(
      "aria-label",
      "Updating preview 25%; 1/3 saved segments reused. Playback starts automatically when ready; choose Live to start now.",
    );
  });

  it("distinguishes persistent restore from frame generation", () => {
    const ctx = createContext();
    ctx.state.previewVideoCache.preparing = true;
    ctx.state.previewVideoCache.persistenceStatus = "restoring";

    syncPlaybackCacheButton(ctx);

    expect(ctx.refs.previewCacheButton.setAttribute).toHaveBeenCalledWith(
      "aria-label",
      "Restoring a saved full-quality preview.",
    );
    expect(ctx.refs.previewCacheButton.classList.toggle).toHaveBeenCalledWith(
      "building",
      true,
    );
  });

  it("restores the timeline preference across page reloads", () => {
    const ctx = createContext();
    vi.stubGlobal("window", {
      localStorage: { getItem: vi.fn<Storage["getItem"]>(() => "false") },
    });

    initializePlaybackCachePreference(ctx);

    expect(ctx.state.previewCacheEnabled).toBe(false);
    expect(ctx.refs.previewCacheButton.setAttribute).toHaveBeenCalledWith(
      "aria-pressed",
      "false",
    );
  });

  it("defaults a new profile to immediate Live playback", () => {
    const ctx = createContext();
    vi.stubGlobal("window", {
      localStorage: { getItem: vi.fn<Storage["getItem"]>(() => null) },
    });

    initializePlaybackCachePreference(ctx);

    expect(ctx.state.previewCacheEnabled).toBe(false);
    expect(ctx.refs.previewLiveModeButton.setAttribute).toHaveBeenCalledWith(
      "aria-pressed",
      "true",
    );
  });

  it("bypasses all cache preparation while disabled", async () => {
    const ctx = createContext();
    ctx.state.previewCacheEnabled = false;

    await beginPlaybackRun(ctx);

    expect(ctx.beginPlaybackVideoCache).not.toHaveBeenCalled();
    expect(ctx.syncPreviewAudio).toHaveBeenCalledWith(1.5);
    expect(ctx.schedulePlaybackTick).toHaveBeenCalledOnce();
  });

  it("records a high-resolution composition into the video cache", async () => {
    const ctx = createContext();
    vi.spyOn(ctx, "shouldPreferPlaybackVideoCache").mockReturnValue(true);
    ctx.beginPlaybackVideoCache.mockResolvedValue("recording");

    await beginPlaybackRun(ctx);

    expect(ctx.beginPlaybackVideoCache).toHaveBeenCalledOnce();
    expect(ctx.state.previewCacheWarmActive).toBe(false);
    expect(ctx.schedulePlaybackTick).toHaveBeenCalledOnce();
  });

  it("falls back to exact frames when high-resolution video is unavailable", async () => {
    const ctx = createContext();
    vi.spyOn(ctx, "shouldPreferPlaybackVideoCache").mockReturnValue(true);
    ctx.beginPlaybackVideoCache.mockResolvedValue("unavailable");

    await beginPlaybackRun(ctx);

    expect(ctx.beginPlaybackVideoCache).toHaveBeenCalledOnce();
    expect(ctx.state.previewCacheWarmActive).toBe(true);
    expect(ctx.schedulePlaybackTick).toHaveBeenCalledOnce();
  });
});
