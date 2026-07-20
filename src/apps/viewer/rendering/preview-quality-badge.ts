import type { ViewerAppContext } from "../app/context.js";
import { resolvePreviewCacheWarmRemainingMs } from "../playback/cache-warm-estimate.js";
import { resolvePreviewCacheWarmProgress } from "../playback/cache-warm.js";

export function syncPreviewQualityBadge(
  ctx: ViewerAppContext,
  scale: number,
): void {
  const previousScale = ctx.state.appliedPreviewScale;
  ctx.state.appliedPreviewScale = scale;
  ctx.syncPlaybackCacheButton?.();
  const badge = ctx.refs.previewQualityBadge;
  if (!badge) {
    return;
  }
  const restoring =
    ctx.state.previewVideoCache?.persistenceStatus === "restoring";
  const warming = ctx.state.previewCacheWarmActive;
  const capacityLimited = ctx.state.previewCacheWarmCapacityLimited === true;
  const text = restoring
    ? ctx.deps.t("viewer.preview.restoringCache", "Restoring saved preview")
    : warming
      ? resolveCacheWarmBadgeText(ctx)
      : capacityLimited
        ? ctx.deps.t(
            "viewer.preview.cacheCapacityLimited",
            "Preview is larger than the lossless cache limit · missing frames render live",
          )
        : "";
  const visible = restoring || warming || capacityLimited;
  syncPreviewQualityAnnouncement(ctx, {
    capacityLimited,
    restoring,
    text,
    warming,
  });
  if (
    Math.abs(previousScale - scale) < 0.0001 &&
    badge.hidden === !visible &&
    badge.textContent === text
  ) {
    return;
  }
  badge.hidden = !visible;
  badge.textContent = text;
}

function syncPreviewQualityAnnouncement(
  ctx: ViewerAppContext,
  status: {
    capacityLimited: boolean;
    restoring: boolean;
    text: string;
    warming: boolean;
  },
): void {
  const announcement = ctx.refs.previewQualityAnnouncement;
  if (!announcement) {
    return;
  }
  const locale = ctx.refs.localeSelect?.value || "ru";
  if (status.capacityLimited) {
    setAnnouncement(
      announcement,
      `${locale}:capacity`,
      "capacity",
      status.text,
    );
    return;
  }
  if (status.restoring) {
    setAnnouncement(
      announcement,
      `${locale}:restoring`,
      "restoring",
      status.text,
    );
    return;
  }
  if (status.warming) {
    const progress = Math.round(
      resolvePreviewCacheWarmProgress(ctx.state) * 100,
    );
    const phase = ctx.state.playing ? "warming" : "paused";
    const milestone = Math.floor(progress / 10) * 10;
    setAnnouncement(
      announcement,
      `${locale}:${phase}:${milestone}`,
      phase,
      status.text,
    );
    return;
  }
  const previousPhase = announcement.dataset.previewAnnouncementPhase;
  const cacheReady =
    ctx.state.previewCacheWarmPrepared === true ||
    ctx.state.previewFrameCacheComplete === true;
  if (
    cacheReady &&
    (previousPhase === "warming" || previousPhase === "paused")
  ) {
    setAnnouncement(
      announcement,
      `${locale}:ready`,
      "ready",
      ctx.deps.t("viewer.preview.cacheReady", "Preview ready"),
    );
    return;
  }
  if (!cacheReady && previousPhase) {
    delete announcement.dataset.previewAnnouncementSignature;
    delete announcement.dataset.previewAnnouncementPhase;
    announcement.textContent = "";
  }
}

function setAnnouncement(
  announcement: HTMLElement,
  signature: string,
  phase: string,
  text: string,
): void {
  if (announcement.dataset.previewAnnouncementSignature === signature) {
    return;
  }
  announcement.dataset.previewAnnouncementSignature = signature;
  announcement.dataset.previewAnnouncementPhase = phase;
  announcement.textContent = text;
}

function resolveCacheWarmBadgeText(ctx: ViewerAppContext): string {
  const progress = String(
    Math.round(resolvePreviewCacheWarmProgress(ctx.state) * 100),
  );
  const visited = String(
    Math.max(0, Number(ctx.state.previewCacheWarmVisitedFrames) || 0),
  );
  const total = String(
    Math.max(1, Number(ctx.state.previewCacheWarmTargetFrames) || 1),
  );
  const restoredSegments = Math.max(
    0,
    Number(ctx.state.previewVideoCache?.restoredSegmentCount) || 0,
  );
  const totalSegments = Math.max(
    restoredSegments,
    Number(ctx.state.previewVideoCache?.segmentPlan?.length) || 0,
  );
  const reusingSegments = restoredSegments > 0 && totalSegments > 0;
  const key = ctx.state.playing
    ? reusingSegments
      ? "viewer.preview.updatingCache"
      : "viewer.preview.preparingCache"
    : reusingSegments
      ? "viewer.preview.cacheUpdatePaused"
      : "viewer.preview.cachePreparationPaused";
  const fallback = ctx.state.playing
    ? reusingSegments
      ? "Updating preview · {restored}/{segments} segments reused · {progress}% · {visited}/{total} frames · {remaining}"
      : "Preparing before playback · {progress}% · {visited}/{total} frames · {remaining}"
    : reusingSegments
      ? "Preview update paused · {restored}/{segments} segments reused · {progress}% · {visited}/{total} frames"
      : "Preview preparation paused · {progress}% · {visited}/{total} frames";
  return ctx.deps
    .t(key, fallback)
    .replace("{progress}", progress)
    .replace("{visited}", visited)
    .replace("{total}", total)
    .replace("{restored}", String(restoredSegments))
    .replace("{segments}", String(totalSegments))
    .replace("{remaining}", resolveCacheWarmRemainingLabel(ctx));
}

function resolveCacheWarmRemainingLabel(ctx: ViewerAppContext): string {
  const remainingMs = resolvePreviewCacheWarmRemainingMs(ctx.state);
  if (remainingMs === null) {
    return ctx.deps.t(
      "viewer.preview.cacheRemainingCalculating",
      "estimating time",
    );
  }
  const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
  if (seconds < 90) {
    return ctx.deps
      .t("viewer.preview.cacheRemainingSeconds", "about {seconds}s")
      .replace("{seconds}", String(seconds));
  }
  return ctx.deps
    .t("viewer.preview.cacheRemainingMinutes", "about {minutes} min")
    .replace("{minutes}", String(Math.ceil(seconds / 60)));
}
