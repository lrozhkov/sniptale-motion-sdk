import type { KeyframeSelectionRef } from "./selection-model.js";

export function keyframeRefKey(ref: KeyframeSelectionRef): string {
  return JSON.stringify([ref.trackId, ref.keyframeId]);
}
