import { vi } from "vitest";
import { createViewerContextFixture } from "./viewer-context-fixture.js";

/** Real playback actions and state, with presentation/audio/scheduling effects isolated. */
export function createViewerPlaybackFixture() {
  const ctx = createViewerContextFixture();
  vi.spyOn(ctx, "isPreviewFullscreenActive").mockReturnValue(false);
  const state = Object.assign(ctx.state, {
    currentTemplate: { id: "template", duration: 8 },
  });
  ctx.refs.fpsInput.value = "30";
  ctx.refs.timeSlider.value = "0";
  ctx.deps.t = (key: string, fallback?: string) => fallback ?? key;
  const beginPlaybackVideoCache = vi
    .spyOn(ctx, "beginPlaybackVideoCache")
    .mockResolvedValue("unavailable");
  const invalidatePlaybackVideoCache = vi
    .spyOn(ctx, "invalidatePlaybackVideoCache")
    .mockResolvedValue(undefined);
  const renderCurrentFrame = vi
    .spyOn(ctx, "renderCurrentFrame")
    .mockResolvedValue(undefined);
  const schedulePlaybackTick = vi
    .spyOn(ctx, "schedulePlaybackTick")
    .mockImplementation(() => {});
  const stopPlaybackVideoCache = vi
    .spyOn(ctx, "stopPlaybackVideoCache")
    .mockImplementation(() => {});
  const stopPreviewAudio = vi
    .spyOn(ctx, "stopPreviewAudio")
    .mockImplementation(() => {});
  const syncPlaybackButtons = vi
    .spyOn(ctx, "syncPlaybackButtons")
    .mockImplementation(() => {});
  vi.spyOn(ctx, "syncPlaybackCacheButton").mockImplementation(() => {});
  const syncPreviewAudio = vi
    .spyOn(ctx, "syncPreviewAudio")
    .mockImplementation(() => {});
  const syncPreviewQualityBadge = vi
    .spyOn(ctx, "syncPreviewQualityBadge")
    .mockImplementation(() => {});
  const updateTimelinePlayhead = vi
    .spyOn(ctx, "updateTimelinePlayhead")
    .mockImplementation(() => {});
  return Object.assign(ctx, {
    state,
    beginPlaybackVideoCache,
    invalidatePlaybackVideoCache,
    renderCurrentFrame,
    schedulePlaybackTick,
    stopPlaybackVideoCache,
    stopPreviewAudio,
    syncPlaybackButtons,
    syncPreviewAudio,
    syncPreviewQualityBadge,
    updateTimelinePlayhead,
  });
}
