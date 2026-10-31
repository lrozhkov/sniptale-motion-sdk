import { describe, expect, it, vi } from "vitest";

import {
  calculateScaledRenderSize,
  createPreviewQualityActions,
} from "../src/apps/viewer/rendering/preview-quality";
import { syncPreviewQualityBadge } from "../src/apps/viewer/rendering/preview-quality-badge";

describe("viewer explicit preview quality", () => {
  it("keeps preview rendering full quality regardless of measured cost", () => {
    const ctx = {
      state: {
        appliedPreviewScale: 0.25,
        averageFullRenderMs: 1200,
        canvasTransformDragActive: true,
        playing: false,
        previewCacheWarmActive: true,
      },
    } as any;
    Object.assign(
      ctx,
      createPreviewQualityActions(() => ctx),
    );

    expect(
      ctx.getPreviewRenderPlan(1280, 720, {
        interactive: true,
        previewScale: 0.25,
      }),
    ).toEqual({
      height: 720,
      renderQuality: "full",
      scale: 1,
      width: 1280,
    });
  });

  it("settles interactions with one explicit full-quality render", async () => {
    const renderCurrentFrame = vi.fn(async () => undefined);
    const ctx = { renderCurrentFrame, state: {} } as any;
    Object.assign(
      ctx,
      createPreviewQualityActions(() => ctx),
    );

    await ctx.settlePreviewAfterInteraction();

    expect(renderCurrentFrame).toHaveBeenCalledOnce();
    expect(renderCurrentFrame).toHaveBeenCalledWith({
      forceFull: true,
      interactive: true,
    });
  });

  it("repairs a stale reduced frame but does not duplicate a full render", async () => {
    const renderCurrentFrame = vi.fn(async () => undefined);
    const updateCanvasSelectionBox = vi.fn();
    const ctx = {
      renderCurrentFrame,
      state: {
        appliedPreviewScale: 0.5,
        canvasTransformPreview: null,
        playing: false,
      },
      updateCanvasSelectionBox,
    } as any;
    Object.assign(
      ctx,
      createPreviewQualityActions(() => ctx),
    );

    await expect(ctx.refinePreviewAtFullQuality()).resolves.toBe(true);
    expect(renderCurrentFrame).toHaveBeenCalledWith({ forceFull: true });

    ctx.state.appliedPreviewScale = 1;
    ctx.state.canvasTransformPreview = { awaitingFullRender: true };
    await expect(ctx.refinePreviewAtFullQuality()).resolves.toBe(false);
    expect(updateCanvasSelectionBox).toHaveBeenCalledOnce();
  });

  it("shows honest active cache progress and remaining-time estimate", () => {
    const badge = { hidden: true, textContent: "" };
    const ctx = createBadgeContext(badge, {
      averagePreviewLatencyMs: 1000,
      playing: true,
      previewCacheWarmAverageFrameMs: 1000,
      previewCacheWarmElapsedMs: 15_000,
      previewCacheWarmSampleCount: 15,
      previewCacheWarmTargetFrames: 100,
      previewCacheWarmVisitedFrames: 37,
    });

    syncPreviewQualityBadge(ctx, 1);

    expect(badge.hidden).toBe(false);
    expect(badge.textContent).toBe(
      "Preparing before playback · 37% · 37/100 frames · about 73s",
    );
  });

  it("distinguishes partial regeneration from a full cache build", () => {
    const badge = { hidden: true, textContent: "" };
    const ctx = createBadgeContext(badge, {
      previewCacheWarmTargetFrames: 32,
      previewCacheWarmVisitedFrames: 8,
      previewVideoCache: {
        restoredSegmentCount: 1,
        segmentPlan: [{}, {}, {}],
      },
    });

    syncPreviewQualityBadge(ctx, 1);

    expect(badge.textContent).toBe(
      "Updating preview · 1/3 segments reused · 25% · 8/32 frames · estimating time",
    );
  });

  it("does not promise a stale ETA before the current warm pass has enough samples", () => {
    const badge = { hidden: true, textContent: "" };
    const ctx = createBadgeContext(badge, {
      averagePreviewLatencyMs: 20,
      lastPreviewLatencyMs: 20,
      playing: true,
      previewCacheWarmAverageFrameMs: 1200,
      previewCacheWarmElapsedMs: 1200,
      previewCacheWarmSampleCount: 1,
      previewCacheWarmTargetFrames: 196,
      previewCacheWarmVisitedFrames: 1,
    });

    syncPreviewQualityBadge(ctx, 1);

    expect(badge.textContent).toBe(
      "Preparing before playback · 1% · 1/196 frames · estimating time",
    );
  });

  it("labels paused preparation without moving or losing progress", () => {
    const badge = { hidden: true, textContent: "" };
    const ctx = createBadgeContext(badge, {
      playing: false,
      previewCacheWarmTargetFrames: 100,
      previewCacheWarmVisitedFrames: 37,
    });

    syncPreviewQualityBadge(ctx, 1);

    expect(badge.hidden).toBe(false);
    expect(badge.textContent).toBe(
      "Preview preparation paused · 37% · 37/100 frames",
    );
  });

  it("reports a bounded lossless cache instead of silently restarting forever", () => {
    const badge = { hidden: true, textContent: "" };
    const ctx = createBadgeContext(badge, {
      previewCacheWarmActive: false,
      previewCacheWarmCapacityLimited: true,
    });

    syncPreviewQualityBadge(ctx, 1);

    expect(badge.hidden).toBe(false);
    expect(badge.textContent).toBe(
      "Preview is larger than the lossless cache limit · missing frames render live",
    );
  });

  it("announces cache preparation at meaningful milestones", () => {
    const badge = { hidden: true, textContent: "" };
    const announcement = createAnnouncement();
    const ctx = createBadgeContext(
      badge,
      {
        playing: true,
        previewCacheWarmTargetFrames: 100,
        previewCacheWarmVisitedFrames: 1,
      },
      announcement,
    );

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
    const badge = { hidden: true, textContent: "" };
    const announcement = createAnnouncement();
    const ctx = createBadgeContext(
      badge,
      {
        playing: true,
        previewCacheWarmTargetFrames: 10,
        previewCacheWarmVisitedFrames: 9,
      },
      announcement,
    );

    syncPreviewQualityBadge(ctx, 1);
    ctx.state.previewCacheWarmActive = false;
    ctx.state.previewCacheWarmPrepared = true;
    syncPreviewQualityBadge(ctx, 1);

    expect(announcement.textContent).toBe("Preview ready");
  });

  it("clears a stale preparation announcement when cache mode is cancelled", () => {
    const badge = { hidden: true, textContent: "" };
    const announcement = createAnnouncement();
    const ctx = createBadgeContext(
      badge,
      {
        playing: true,
        previewCacheWarmTargetFrames: 10,
        previewCacheWarmVisitedFrames: 2,
      },
      announcement,
    );

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

function createAnnouncement() {
  return {
    dataset: {},
    textContent: "",
  } as any;
}

function createBadgeContext(badge, overrides, announcement = null) {
  return {
    deps: {
      t: (_key: string, fallback: string) => fallback,
    },
    refs: {
      localeSelect: { value: "en" },
      previewQualityAnnouncement: announcement,
      previewQualityBadge: badge,
    },
    state: {
      appliedPreviewScale: 1,
      averagePreviewLatencyMs: 0,
      lastPreviewLatencyMs: 0,
      playing: true,
      previewCacheWarmActive: true,
      previewCacheWarmAverageFrameMs: 0,
      previewCacheWarmCapacityLimited: false,
      previewCacheWarmElapsedMs: 0,
      previewCacheWarmPrepared: false,
      previewCacheWarmSampleCount: 0,
      previewCacheWarmTargetFrames: 0,
      previewCacheWarmVisitedFrames: 0,
      previewFrameCacheComplete: false,
      ...overrides,
    },
  } as any;
}
