import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import type { ViewerAppContext } from "../src/apps/viewer/app/context.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { calculateScaledRenderSize } from "../src/apps/viewer/rendering/preview-quality";
import { syncPreviewQualityBadge } from "../src/apps/viewer/rendering/preview-quality-badge";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("viewer explicit preview quality", () => {
  it("keeps preview rendering full quality regardless of measured cost", () => {
    const ctx = createViewerContextFixture();
    Object.assign(ctx.state, {
      appliedPreviewScale: 0.25,
      averageFullRenderMs: 1200,
      canvasTransformDragActive: true,
      playing: false,
      previewCacheWarmActive: true,
    } satisfies Partial<ViewerAppContext["state"]>);

    expect(
      ctx.getPreviewRenderPlan(1280, 720, {
        interactive: true,
      }),
    ).toEqual({
      height: 720,
      renderQuality: "full",
      scale: 1,
      width: 1280,
    });
  });

  it("settles interactions with one explicit full-quality render", async () => {
    const ctx = createViewerContextFixture();
    const renderCurrentFrame = vi
      .spyOn(ctx, "renderCurrentFrame")
      .mockResolvedValue(undefined);
    await ctx.settlePreviewAfterInteraction();

    expect(renderCurrentFrame).toHaveBeenCalledOnce();
    expect(renderCurrentFrame).toHaveBeenCalledWith({
      forceFull: true,
      interactive: true,
    });
  });

  it("repairs a stale reduced frame but does not duplicate a full render", async () => {
    const ctx = createViewerContextFixture();
    const renderCurrentFrame = vi
      .spyOn(ctx, "renderCurrentFrame")
      .mockResolvedValue(undefined);
    const updateCanvasSelectionBox = vi
      .spyOn(ctx, "updateCanvasSelectionBox")
      .mockImplementation(() => {});
    ctx.state.appliedPreviewScale = 0.5;
    ctx.state.playing = false;
    await expect(ctx.refinePreviewAtFullQuality()).resolves.toBe(true);
    expect(renderCurrentFrame).toHaveBeenCalledWith({ forceFull: true });

    ctx.state.appliedPreviewScale = 1;
    ctx.state.canvasTransformPreview = {
      awaitingFullRender: true,
      templateId: null,
      boxes: {},
    };
    await expect(ctx.refinePreviewAtFullQuality()).resolves.toBe(false);
    expect(updateCanvasSelectionBox).toHaveBeenCalledOnce();
  });

  it("shows honest active cache progress and remaining-time estimate", () => {
    const ctx = createBadgeContext({
      averagePreviewLatencyMs: 1000,
      playing: true,
      previewCacheWarmAverageFrameMs: 1000,
      previewCacheWarmElapsedMs: 15_000,
      previewCacheWarmSampleCount: 15,
      previewCacheWarmTargetFrames: 100,
      previewCacheWarmVisitedFrames: 37,
    });
    const badge = ctx.refs.previewQualityBadge;

    syncPreviewQualityBadge(ctx, 1);

    expect(badge.hidden).toBe(false);
    expect(badge.textContent).toBe(
      "Preparing before playback · 37% · 37/100 frames · about 73s",
    );
  });

  it("distinguishes partial regeneration from a full cache build", () => {
    const ctx = createBadgeContext({
      previewCacheWarmTargetFrames: 32,
      previewCacheWarmVisitedFrames: 8,
      previewVideoCache: {
        restoredSegmentCount: 1,
        segmentPlan: Array.from({ length: 3 }, (_, index) => ({
          index,
          startFrame: index * 10,
          endFrame: (index + 1) * 10,
          startTime: index,
          endTime: index + 1,
        })),
      },
    });
    const badge = ctx.refs.previewQualityBadge;

    syncPreviewQualityBadge(ctx, 1);

    expect(badge.textContent).toBe(
      "Updating preview · 1/3 segments reused · 25% · 8/32 frames · estimating time",
    );
  });

  it("does not promise a stale ETA before the current warm pass has enough samples", () => {
    const ctx = createBadgeContext({
      averagePreviewLatencyMs: 20,
      lastPreviewLatencyMs: 20,
      playing: true,
      previewCacheWarmAverageFrameMs: 1200,
      previewCacheWarmElapsedMs: 1200,
      previewCacheWarmSampleCount: 1,
      previewCacheWarmTargetFrames: 196,
      previewCacheWarmVisitedFrames: 1,
    });
    const badge = ctx.refs.previewQualityBadge;

    syncPreviewQualityBadge(ctx, 1);

    expect(badge.textContent).toBe(
      "Preparing before playback · 1% · 1/196 frames · estimating time",
    );
  });

  it("labels paused preparation without moving or losing progress", () => {
    const ctx = createBadgeContext({
      playing: false,
      previewCacheWarmTargetFrames: 100,
      previewCacheWarmVisitedFrames: 37,
    });
    const badge = ctx.refs.previewQualityBadge;

    syncPreviewQualityBadge(ctx, 1);

    expect(badge.hidden).toBe(false);
    expect(badge.textContent).toBe(
      "Preview preparation paused · 37% · 37/100 frames",
    );
  });

  it("reports a bounded lossless cache instead of silently restarting forever", () => {
    const ctx = createBadgeContext({
      previewCacheWarmActive: false,
      previewCacheWarmCapacityLimited: true,
    });
    const badge = ctx.refs.previewQualityBadge;

    syncPreviewQualityBadge(ctx, 1);

    expect(badge.hidden).toBe(false);
    expect(badge.textContent).toBe(
      "Preview is larger than the lossless cache limit · missing frames render live",
    );
  });

  it("announces cache preparation at meaningful milestones", () => {
    const ctx = createBadgeContext({
      playing: true,
      previewCacheWarmTargetFrames: 100,
      previewCacheWarmVisitedFrames: 1,
    });
    const badge = ctx.refs.previewQualityBadge;
    const announcement = ctx.refs.previewQualityAnnouncement;

    syncPreviewQualityBadge(ctx, 1);
    expect(announcement.textContent).toContain("1% · 1/100 frames");

    ctx.state.previewCacheWarmVisitedFrames = 7;
    syncPreviewQualityBadge(ctx, 1);
    expect(badge.textContent).toContain("7% · 7/100 frames");
    expect(announcement.textContent).toContain("1% · 1/100 frames");

    ctx.state.previewCacheWarmVisitedFrames = 10;
    syncPreviewQualityBadge(ctx, 1);
    expect(announcement.textContent).toContain("10% · 10/100 frames");
  });

  it("announces cache readiness after preparation finishes", () => {
    const ctx = createBadgeContext({
      playing: true,
      previewCacheWarmTargetFrames: 10,
      previewCacheWarmVisitedFrames: 9,
    });
    const announcement = ctx.refs.previewQualityAnnouncement;

    syncPreviewQualityBadge(ctx, 1);
    ctx.state.previewCacheWarmActive = false;
    ctx.state.previewCacheWarmPrepared = true;
    syncPreviewQualityBadge(ctx, 1);

    expect(announcement.textContent).toBe("Preview ready");
  });

  it("clears a stale preparation announcement when cache mode is cancelled", () => {
    const ctx = createBadgeContext({
      playing: true,
      previewCacheWarmTargetFrames: 10,
      previewCacheWarmVisitedFrames: 2,
    });
    const announcement = ctx.refs.previewQualityAnnouncement;

    syncPreviewQualityBadge(ctx, 1);
    ctx.state.previewCacheWarmActive = false;
    syncPreviewQualityBadge(ctx, 1);

    expect(announcement.textContent).toBe("");
    expect(announcement.dataset).toEqual({});
  });

  it("keeps contract samples proportional and bounded", () => {
    expect(calculateScaledRenderSize(1280, 720, 0.25)).toEqual({
      height: 180,
      scale: 0.25,
      width: 320,
    });
    expect(calculateScaledRenderSize(320, 180, 0.25)).toEqual({
      height: 90,
      scale: 0.5,
      width: 160,
    });
  });
});

type BadgeStateOverrides = Partial<
  Omit<ViewerAppContext["state"], "previewVideoCache">
> & {
  previewVideoCache?: Partial<ViewerAppContext["state"]["previewVideoCache"]>;
};

function createBadgeContext(overrides: BadgeStateOverrides) {
  const ctx = createViewerContextFixture();
  ctx.deps.t = (key, fallback) => fallback ?? key;
  ctx.refs.localeSelect.value = "en";
  ctx.refs.previewQualityBadge.hidden = true;
  vi.spyOn(ctx, "syncPlaybackCacheButton").mockImplementation(() => {});
  const { previewVideoCache, ...state } = overrides;
  Object.assign(ctx.state, {
    appliedPreviewScale: 1,
    playing: true,
    previewCacheWarmActive: true,
    ...state,
  } satisfies Partial<ViewerAppContext["state"]>);
  Object.assign(ctx.state.previewVideoCache, previewVideoCache);
  return ctx;
}
