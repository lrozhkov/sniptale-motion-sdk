import type { ViewerAppContext } from "../app/context.js";
import { cancelPreviewCacheWarm } from "./cache-warm.js";

export function pausePlaybackCacheBuild(
  ctx: ViewerAppContext,
  preservePreparation = true,
): boolean {
  const videoCache = ctx.state.previewVideoCache;
  const preserve = Boolean(
    preservePreparation &&
    ctx.state.previewCacheEnabled !== false &&
    (ctx.state.previewCacheWarmActive ||
      videoCache?.preparePromise ||
      videoCache?.preparing ||
      videoCache?.recording ||
      videoCache?.finalizing),
  );
  ctx.stopPlaybackVideoCache?.(!preserve);
  if (preserve) {
    ctx.syncPreviewQualityBadge?.(ctx.state.appliedPreviewScale || 1);
  } else {
    cancelPreviewCacheWarm(ctx.state);
  }
  return preserve;
}
