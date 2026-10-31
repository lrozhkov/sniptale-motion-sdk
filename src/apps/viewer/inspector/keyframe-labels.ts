import type { MotionPathTrack } from "../../../shared/timeline/motion-path.js";
import type { TimelineKeyframe } from "../../../sdk/types.js";
import type { ViewerAppContext } from "../app/context.js";

export const KEYFRAME_EASING_PRESETS = [
  "linear",
  "in",
  "out",
  "inOut",
  "hold",
  "back",
  "bezier",
] as const;

export function getKeyframeEasingLabel(
  ctx: ViewerAppContext,
  easing: unknown,
): string {
  const value =
    typeof easing === "string" && easing.trim() ? easing.trim() : "linear";
  return ctx.deps.t(
    `viewer.inspector.curvePresets.${value}`,
    ctx.toTitleLabel?.(value) ?? value,
  );
}

export function getKeyframeDisplayLabel(
  ctx: ViewerAppContext,
  track: MotionPathTrack,
  keyframe: TimelineKeyframe<unknown> | null | undefined,
): string {
  const trackLabel = ctx.getTimelineTrackDisplayLabel(track);
  return keyframe
    ? `${trackLabel} · ${ctx.formatSeconds(keyframe.time)}`
    : trackLabel;
}
