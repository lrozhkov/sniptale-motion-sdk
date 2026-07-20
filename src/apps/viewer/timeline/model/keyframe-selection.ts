export type KeyframeSelectionRef = {
  keyframeId: string;
  trackId: string;
};

export type ResolvedKeyframeSelection = KeyframeSelectionRef & {
  keyframe: any;
  track: any;
};

export function canonicalizeKeyframeSelection(
  timeline,
  refs: unknown,
): KeyframeSelectionRef[] {
  const trackById = new Map<string, any>(
    (timeline?.tracks ?? []).map((track) => [String(track.id), track]),
  );
  const result: KeyframeSelectionRef[] = [];
  const seen = new Set<string>();
  for (const value of Array.isArray(refs) ? refs : []) {
    const trackId = String(value?.trackId ?? "");
    const keyframeId = String(value?.keyframeId ?? "");
    const track = trackById.get(trackId);
    if (
      !trackId ||
      !keyframeId ||
      !track?.keyframes?.some((keyframe) => String(keyframe.id) === keyframeId)
    ) {
      continue;
    }
    const key = `${trackId}:${keyframeId}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ keyframeId, trackId });
    }
  }
  return result;
}

export function resolveKeyframeSelection(
  timeline,
  refs: unknown,
): ResolvedKeyframeSelection[] {
  return canonicalizeKeyframeSelection(timeline, refs)
    .map((ref) => {
      const track = timeline.tracks.find((item) => item.id === ref.trackId);
      const keyframe = track?.keyframes?.find(
        (item) => item.id === ref.keyframeId,
      );
      return track && keyframe ? { ...ref, keyframe, track } : null;
    })
    .filter(Boolean);
}

export function getKeyframeSelectionBounds(entries): {
  count: number;
  duration: number;
  end: number;
  start: number;
} | null {
  if (!Array.isArray(entries) || entries.length === 0) {
    return null;
  }
  const times = entries.map((entry) => Number(entry.keyframe.time) || 0);
  const start = Math.min(...times);
  const end = Math.max(...times);
  return { count: entries.length, duration: end - start, end, start };
}
