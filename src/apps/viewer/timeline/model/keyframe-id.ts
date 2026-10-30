import type { ViewerAppContext } from "../../app/context.js";

function createKeyframeId(
  ctx: ViewerAppContext,
  timeline,
  trackId,
  label,
  time,
) {
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

export function installTimelineKeyframeIdOwner(ctx: ViewerAppContext): void {
  ctx.createKeyframeId = createKeyframeId.bind(undefined, ctx);
}
