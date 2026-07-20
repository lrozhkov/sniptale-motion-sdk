import type { ViewerAppContext } from "../app/context.js";
import { invalidatePlaybackVideoCache } from "./video-cache-reset.js";

export async function fallBackToExactFrameCache(
  ctx: ViewerAppContext,
  failedKey: string | null,
): Promise<void> {
  const wasPlaying = ctx.state.playing;
  const templateId = ctx.state.currentTemplate?.id;
  const cache = ctx.state.previewVideoCache;
  const invalidation = invalidatePlaybackVideoCache(ctx);
  const generation = cache.generation;
  await invalidation;
  if (
    generation !== cache.generation ||
    ctx.state.currentTemplate?.id !== templateId
  ) {
    return;
  }
  cache.fallbackKey = failedKey;
  cache.error = null;
  if (
    wasPlaying &&
    ctx.state.playing &&
    ctx.state.currentTemplate?.id === templateId &&
    ctx.state.previewCacheEnabled !== false
  ) {
    ctx.beginPlaybackCacheWarm?.(true);
  }
}
