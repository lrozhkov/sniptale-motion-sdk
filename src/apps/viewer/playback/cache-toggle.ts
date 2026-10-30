import type { ViewerAppContext } from "../app/context.js";
import { resolvePreviewCacheWarmProgress } from "./cache-warm.js";
import { beginPlaybackRun } from "./run.js";
import {
  beginPlaybackRunState,
  isPlaybackPreparationPhase,
  setPlaybackRunPhase,
  syncPlaybackRunState,
} from "./run-state.js";

const STORAGE_KEY = "effect-sdk-preview-cache-enabled";

export function setPlaybackCacheEnabled(
  ctx: ViewerAppContext,
  enabled: boolean,
): void {
  if (enabled && ctx.state.currentTemplate?.domMotion) return;
  const next = Boolean(enabled);
  const current = ctx.state.previewCacheEnabled !== false;
  if (next === current) {
    syncPlaybackCacheButton(ctx);
    return;
  }
  const cache = ctx.state.previewVideoCache;
  ctx.state.previewCacheEnabled = next;
  persistPlaybackCachePreference(next);
  syncPlaybackCacheButton(ctx);
  if (next) {
    if (ctx.state.playing) {
      void beginPlaybackRun(ctx, beginPlaybackRunState(ctx));
    }
    return;
  }
  ctx.state.previewCacheWarmCapacityLimited = false;
  const building =
    ctx.state.previewCacheWarmActive ||
    cache.preparePromise ||
    cache.preparing ||
    cache.recording ||
    cache.finalizing;
  ctx.stopPlaybackVideoCache?.(false);
  if (building) {
    void ctx.invalidatePlaybackVideoCache?.();
  }
  ctx.syncPlaybackButtons?.();
  if (ctx.state.playing) {
    const token = beginPlaybackRunState(ctx);
    setPlaybackRunPhase(ctx, token, "live");
    const time = Number(ctx.refs.timeSlider.value) || 0;
    ctx.syncPreviewAudio?.(time);
    ctx.lastPlaybackAudioTs = performance.now();
    void ctx.renderCurrentFrame();
    ctx.schedulePlaybackTick();
  }
}

export function initializePlaybackCachePreference(ctx: ViewerAppContext): void {
  ctx.state.previewCacheEnabled = readPlaybackCachePreference() ?? false;
  syncPlaybackCacheButton(ctx);
}

export function syncPlaybackCacheButton(ctx: ViewerAppContext): void {
  if (!ctx.refs.previewCacheButton || !ctx.refs.previewLiveModeButton) {
    return;
  }
  const enabled = ctx.state.previewCacheEnabled !== false;
  const cache = ctx.state.previewVideoCache;
  const phase = syncPlaybackRunState(ctx);
  const restoring = enabled && cache?.persistenceStatus === "restoring";
  const building = enabled && isPlaybackPreparationPhase(phase);
  const progress = String(
    Math.round(resolvePreviewCacheWarmProgress(ctx.state) * 100),
  );
  const restoredSegments = Math.max(
    0,
    Number(cache?.restoredSegmentCount) || 0,
  );
  const totalSegments = Math.max(
    restoredSegments,
    Number(cache?.segmentPlan?.length) || 0,
  );
  const reusingSegments = building && restoredSegments > 0 && totalSegments > 0;
  const cacheLabel = restoring
    ? ctx.deps.t(
        "viewer.preview.cacheRestoringButton",
        "Restoring a saved full-quality preview.",
      )
    : building
      ? ctx.deps
          .t(
            reusingSegments
              ? "viewer.preview.cacheUpdatingButton"
              : "viewer.preview.cacheBuildingButton",
            reusingSegments
              ? "Updating preview {progress}%; {restored}/{segments} saved segments reused. Playback starts automatically when ready; choose Live to start now."
              : "Preparing preview {progress}%. Playback starts automatically when ready; choose Live to start now.",
          )
          .replace("{progress}", progress)
          .replace("{restored}", String(restoredSegments))
          .replace("{segments}", String(totalSegments))
      : cache?.ready && cache?.persistent
        ? ctx.deps.t(
            "viewer.preview.cachePersistentReady",
            "Cache + preview mode: the saved full-quality preview is ready for reuse.",
          )
        : ctx.deps.t(
            "viewer.preview.cachedModeDescription",
            "Cache + preview mode: prepare full-quality playback once and defer heavy canvas renders until the interaction pauses.",
          );
  const liveLabel = ctx.deps.t(
    "viewer.preview.liveModeDescription",
    "Live mode: start immediately and render every playback and canvas interaction frame.",
  );
  ctx.refs.previewCacheButton.classList.toggle("building", building);
  ctx.refs.previewCacheButton.setAttribute("aria-pressed", String(enabled));
  ctx.refs.previewCacheButton.setAttribute("aria-label", cacheLabel);
  ctx.refs.previewCacheButton.title = cacheLabel;
  ctx.refs.previewLiveModeButton.setAttribute("aria-pressed", String(!enabled));
  ctx.refs.previewLiveModeButton.setAttribute("aria-label", liveLabel);
  ctx.refs.previewLiveModeButton.title = liveLabel;
}

export function installPlaybackCacheToggleOwner(ctx: ViewerAppContext): void {
  ctx.initializePlaybackCachePreference = () =>
    initializePlaybackCachePreference(ctx);
  ctx.setPlaybackCacheEnabled = setPlaybackCacheEnabled.bind(undefined, ctx);
  ctx.syncPlaybackCacheButton = () => syncPlaybackCacheButton(ctx);
}

function readPlaybackCachePreference(): boolean | null {
  try {
    const value = window.localStorage?.getItem(STORAGE_KEY);
    return value === "true" ? true : value === "false" ? false : null;
  } catch {
    return null;
  }
}

function persistPlaybackCachePreference(enabled: boolean): void {
  try {
    window.localStorage?.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // Preference persistence is best-effort when browser storage is blocked.
  }
}
