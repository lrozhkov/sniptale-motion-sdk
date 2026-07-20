import type { ViewerAppContext } from "../app/context.js";

export function invalidateStalePlaybackVideoCache(ctx: ViewerAppContext): void {
  const cache = ctx.state.previewVideoCache;
  const active =
    cache?.playbackActive ||
    cache?.preparing ||
    cache?.recording ||
    cache?.finalizing;
  if (active && !ctx.isPlaybackVideoCacheCurrent?.()) {
    void ctx.invalidatePlaybackVideoCache?.();
  }
}
