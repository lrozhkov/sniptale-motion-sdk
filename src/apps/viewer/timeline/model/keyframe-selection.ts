import { keyframeRefKey } from "./keyframe-reference.js";
import { parseKeyframeSelectionRef } from "./selection-validation.js";
import type { TimelineKeyframe } from "../../../../sdk/types.js";
import type { MotionPathTrack } from "../../../../shared/timeline/motion-path.js";
import type { KeyframeSelectionRef } from "./selection-model.js";
export type { KeyframeSelectionRef } from "./selection-model.js";

export type KeyframeIdentityTimeline = {
  tracks?: readonly {
    id: string;
    keyframes?: readonly { id: string }[];
  }[];
};

type SelectionTimeline =
  | { tracks?: readonly MotionPathTrack[] }
  | null
  | undefined;

export type ResolvedKeyframeSelection = KeyframeSelectionRef & {
  keyframe: TimelineKeyframe<unknown>;
  track: MotionPathTrack;
};

export function canonicalizeKeyframeSelection(
  timeline: KeyframeIdentityTimeline | null | undefined,
  refs: unknown,
): KeyframeSelectionRef[] {
  const trackById = new Map(
    (timeline?.tracks ?? []).map((track) => [String(track.id), track]),
  );
  const result: KeyframeSelectionRef[] = [];
  const seen = new Set<string>();
  for (const value of Array.isArray(refs) ? refs : []) {
    const ref = parseKeyframeSelectionRef(value);
    if (!ref) continue;
    const { trackId, keyframeId } = ref;
    const track = trackById.get(trackId);
    if (
      !trackId ||
      !keyframeId ||
      !track?.keyframes?.some((keyframe) => String(keyframe.id) === keyframeId)
    ) {
      continue;
    }
    const key = keyframeRefKey(ref);
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ keyframeId, trackId });
    }
  }
  return result;
}

export function resolveKeyframeSelection(
  timeline: SelectionTimeline,
  refs: unknown,
): ResolvedKeyframeSelection[] {
  return canonicalizeKeyframeSelection(timeline, refs)
    .map((ref) => {
      const track = timeline?.tracks?.find((item) => item.id === ref.trackId);
      const keyframe = track?.keyframes?.find(
        (item) => item.id === ref.keyframeId,
      );
      return track && keyframe ? { ...ref, keyframe, track } : null;
    })
    .filter((entry): entry is ResolvedKeyframeSelection => entry !== null);
}

export function getKeyframeSelectionBounds(
  entries: readonly { keyframe: { time: number } }[] | null | undefined,
): {
  count: number;
  duration: number;
  end: number;
  start: number;
} | null {
  if (!entries || entries.length === 0) {
    return null;
  }
  const times = entries.map((entry) => Number(entry.keyframe.time) || 0);
  const start = Math.min(...times);
  const end = Math.max(...times);
  return { count: entries.length, duration: end - start, end, start };
}
