import { keyframeRefKey } from "./keyframe-reference.js";
import {
  getKeyframeSelectionBounds,
  canonicalizeKeyframeSelection,
  type KeyframeSelectionRef,
} from "./keyframe-selection.js";

export type KeyframeTimeSnapshot = {
  bounds: NonNullable<ReturnType<typeof getKeyframeSelectionBounds>>;
  duration: number;
  entries: {
    keyframeId: string;
    time: number;
    trackId: string;
  }[];
  frameDuration: number;
  refs: KeyframeSelectionRef[];
  unselectedTimesByTrack: Map<string, number[]>;
};

type KeyframeTimeTimeline = {
  tracks: readonly {
    id: string;
    keyframes: readonly { id: string; time: number }[];
  }[];
};

export type KeyframeTimeUpdate = Readonly<
  KeyframeSelectionRef & { time: number }
>;

export type KeyframeTimePlan =
  | {
      ok: true;
      updates: readonly KeyframeTimeUpdate[];
    }
  | {
      ok: false;
      reason:
        | "collision"
        | "insufficient-selection"
        | "invalid-scale"
        | "no-change"
        | "out-of-range";
    };

export function createKeyframeTimeSnapshot(
  timeline: KeyframeTimeTimeline,
  refs: unknown,
  duration: number,
  frameDuration: number,
): KeyframeTimeSnapshot | null {
  const resolved = canonicalizeKeyframeSelection(timeline, refs).flatMap(
    (ref) => {
      const track = timeline.tracks.find(
        (candidate) => candidate.id === ref.trackId,
      );
      const keyframe = track?.keyframes.find(
        (candidate) => candidate.id === ref.keyframeId,
      );
      return keyframe ? [{ ...ref, keyframe }] : [];
    },
  );
  const bounds = getKeyframeSelectionBounds(resolved);
  if (!bounds) {
    return null;
  }
  const selected = new Set(resolved.map((entry) => keyframeRefKey(entry)));
  const unselectedTimesByTrack = new Map<string, number[]>();
  for (const track of timeline.tracks ?? []) {
    unselectedTimesByTrack.set(
      track.id,
      (track.keyframes ?? [])
        .filter(
          (keyframe) =>
            !selected.has(
              keyframeRefKey({ trackId: track.id, keyframeId: keyframe.id }),
            ),
        )
        .map((keyframe) => Number(keyframe.time) || 0),
    );
  }
  return {
    bounds,
    duration: Math.max(0, Number(duration) || 0),
    entries: resolved.map((entry) => ({
      keyframeId: entry.keyframeId,
      time: Number(entry.keyframe.time) || 0,
      trackId: entry.trackId,
    })),
    frameDuration: Math.max(0.0001, Number(frameDuration) || 1 / 30),
    refs: resolved.map(({ keyframeId, trackId }) => ({
      keyframeId,
      trackId,
    })),
    unselectedTimesByTrack,
  };
}

export function createKeyframeMovePlan(
  snapshot: KeyframeTimeSnapshot,
  requestedDelta: number,
): KeyframeTimePlan {
  const minDelta = -snapshot.bounds.start;
  const maxDelta = snapshot.duration - snapshot.bounds.end;
  const delta = clamp(Number(requestedDelta) || 0, minDelta, maxDelta);
  return createKeyframeTimePlan(
    snapshot,
    snapshot.entries.map((entry) => ({ ...entry, time: entry.time + delta })),
  );
}

export function createKeyframeScalePlan(
  snapshot: KeyframeTimeSnapshot,
  requestedFactor: number,
  pivot: "center" | "end" | "start" = "start",
  snapTime: (time: number) => number = (time) => time,
): KeyframeTimePlan {
  const factor = Number(requestedFactor);
  if (!Number.isFinite(factor) || factor <= 0) {
    return { ok: false, reason: "invalid-scale" };
  }
  if (snapshot.bounds.duration <= 0) {
    return { ok: false, reason: "insufficient-selection" };
  }
  const pivotTime =
    pivot === "end"
      ? snapshot.bounds.end
      : pivot === "center"
        ? (snapshot.bounds.start + snapshot.bounds.end) / 2
        : snapshot.bounds.start;
  return createKeyframeTimePlan(
    snapshot,
    snapshot.entries.map((entry) => ({
      ...entry,
      time: snapTime(pivotTime + (entry.time - pivotTime) * factor),
    })),
  );
}

export function createKeyframeAlignPlan(
  snapshot: KeyframeTimeSnapshot,
  targetTime: number,
): KeyframeTimePlan {
  if (snapshot.entries.length < 2) {
    return { ok: false, reason: "insufficient-selection" };
  }
  return createKeyframeTimePlan(
    snapshot,
    snapshot.entries.map((entry) => ({ ...entry, time: Number(targetTime) })),
  );
}

export function createKeyframeDistributePlan(
  snapshot: KeyframeTimeSnapshot,
  snapTime: (time: number) => number = (time) => time,
): KeyframeTimePlan {
  if (snapshot.entries.length < 3 || snapshot.bounds.duration <= 0) {
    return { ok: false, reason: "insufficient-selection" };
  }
  const ordered = [...snapshot.entries].sort(
    (left, right) =>
      left.time - right.time ||
      left.trackId.localeCompare(right.trackId) ||
      left.keyframeId.localeCompare(right.keyframeId),
  );
  const step = snapshot.bounds.duration / (ordered.length - 1);
  return createKeyframeTimePlan(
    snapshot,
    ordered.map((entry, index) => ({
      ...entry,
      time: snapTime(snapshot.bounds.start + step * index),
    })),
  );
}

export function createKeyframeQuantizePlan(
  snapshot: KeyframeTimeSnapshot,
  snapTime: (time: number) => number,
): KeyframeTimePlan {
  return createKeyframeTimePlan(
    snapshot,
    snapshot.entries.map((entry) => ({ ...entry, time: snapTime(entry.time) })),
  );
}

export function createKeyframeTimePlan(
  snapshot: KeyframeTimeSnapshot,
  updates: readonly KeyframeTimeUpdate[],
): KeyframeTimePlan {
  if (updates.length !== snapshot.entries.length) {
    return { ok: false, reason: "out-of-range" };
  }
  const updateByRef = new Map<string, KeyframeTimeUpdate>();
  for (const update of updates) {
    const key = keyframeRefKey(update);
    if (updateByRef.has(key)) return { ok: false, reason: "collision" };
    updateByRef.set(key, update);
  }
  const accepted: KeyframeTimeUpdate[] = [];
  const epsilon = Math.min(0.0001, snapshot.frameDuration * 0.1);
  const plannedByTrack = new Map<string, number[]>();
  let changed = false;
  for (const entry of snapshot.entries) {
    const update = updateByRef.get(keyframeRefKey(entry));
    if (!update) return { ok: false, reason: "out-of-range" };
    const time = Number(update.time);
    if (
      !Number.isFinite(time) ||
      time < -epsilon ||
      time > snapshot.duration + epsilon
    ) {
      return { ok: false, reason: "out-of-range" };
    }
    changed = changed || Math.abs(time - entry.time) > epsilon;
    const planned = plannedByTrack.get(entry.trackId) ?? [];
    if (planned.some((candidate) => Math.abs(candidate - time) <= epsilon)) {
      return { ok: false, reason: "collision" };
    }
    if (
      (snapshot.unselectedTimesByTrack.get(entry.trackId) ?? []).some(
        (candidate) => Math.abs(candidate - time) <= epsilon,
      )
    ) {
      return { ok: false, reason: "collision" };
    }
    accepted.push({
      trackId: entry.trackId,
      keyframeId: entry.keyframeId,
      time,
    });
    planned.push(time);
    plannedByTrack.set(entry.trackId, planned);
  }
  return changed
    ? { ok: true, updates: accepted }
    : { ok: false, reason: "no-change" };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
