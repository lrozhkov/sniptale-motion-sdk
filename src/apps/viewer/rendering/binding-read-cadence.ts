const PLAYBACK_BINDING_READ_INTERVAL_MS = 1000 / 12;

export function shouldCapturePlaybackBindingReads(
  state: any,
  layerId: string | null,
  now: number,
): boolean {
  if (!layerId) {
    state.playbackBindingLayerId = null;
    state.lastPlaybackBindingReadAtMs = 0;
    return false;
  }
  const selectionChanged = state.playbackBindingLayerId !== layerId;
  if (
    !selectionChanged &&
    state.lastPlaybackBindingReadAtMs &&
    now - state.lastPlaybackBindingReadAtMs < PLAYBACK_BINDING_READ_INTERVAL_MS
  ) {
    return false;
  }
  state.playbackBindingLayerId = layerId;
  state.lastPlaybackBindingReadAtMs = now;
  return true;
}
