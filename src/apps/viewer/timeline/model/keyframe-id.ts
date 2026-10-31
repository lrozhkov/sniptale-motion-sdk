export type KeyframeIdTimeline = {
  tracks: readonly { keyframes: readonly { id: string }[] }[];
};

export function createKeyframeId(
  timeline: KeyframeIdTimeline,
  trackId: string,
  label: string,
  time: number,
): string {
  const base =
    `${trackId}-${label}-${time.toFixed(3).replace(".", "-")}`.replace(
      /[^a-zA-Z0-9._-]/g,
      "-",
    );
  const ids = new Set(
    timeline.tracks.flatMap((track) =>
      track.keyframes.map((keyframe) => keyframe.id),
    ),
  );
  let suffix = 1;
  let nextId = base;
  while (ids.has(nextId)) {
    suffix += 1;
    nextId = `${base}-${suffix}`;
  }
  return nextId;
}
