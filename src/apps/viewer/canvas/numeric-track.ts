import type { TimelineKeyframe, EffectScene } from "../../../sdk/types.js";
import type { MotionPathTrack } from "../../../shared/timeline/motion-path.js";
import type { CanvasMotionPathTimeline } from "./motion-path-model.js";
import type { ViewerAppContext } from "../app/context.js";
import { resolveTimelineEase } from "../../../sdk/timeline/easing.js";
import { resolveViewerMotionPathTrackValue } from "./motion-path-resolver.js";

export function resolveNumericTrack(
  ctx: { deps: Pick<ViewerAppContext["deps"], "clamp"> },
  track: MotionPathTrack | null | undefined,
  time: number,
  fallback: number,
  timeline: CanvasMotionPathTimeline | null = null,
) {
  if (
    track?.enabled === false ||
    !isTimelineOwnerEnabled(timeline, track?.sceneId, track?.phaseId)
  ) {
    return fallback;
  }
  const motionPathValue = resolveViewerMotionPathTrackValue(
    track,
    time,
    timeline,
  );
  if (motionPathValue !== null) {
    return motionPathValue;
  }
  const keyframes = (track?.keyframes ?? []).filter(
    (item): item is TimelineKeyframe<number> =>
      item.enabled !== false &&
      typeof item.value === "number" &&
      Number.isFinite(item.value) &&
      Number.isFinite(item.time) &&
      isTimelineOwnerEnabled(timeline, item.sceneId, item.phaseId),
  );
  if (keyframes.length === 0) {
    return fallback;
  }
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  const first = sorted[0];
  const last = sorted.at(-1);
  if (!first || !last) return fallback;
  if (time <= first.time) {
    return first.value;
  }
  if (time >= last.time) {
    return last.value;
  }
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const from = sorted[index];
    const to = sorted[index + 1];
    if (!from || !to) continue;
    if (time >= from.time && time <= to.time) {
      const t = ctx.deps.clamp(
        (time - from.time) / Math.max(0.001, to.time - from.time),
        0,
        1,
      );
      const eased = resolveTimelineEase(from, t);
      return from.value + (to.value - from.value) * eased;
    }
  }
  return fallback;
}

function isTimelineOwnerEnabled(
  timeline: CanvasMotionPathTimeline | null,
  sceneId: string | null | undefined,
  phaseId: string | null | undefined,
) {
  if (!timeline) {
    return true;
  }
  if (!isSceneEnabled(timeline.scenes, sceneId)) {
    return false;
  }
  if (!phaseId) {
    return true;
  }
  const phase = timeline.phases?.find((item) => item.id === phaseId);
  return Boolean(
    phase &&
    phase.enabled !== false &&
    isSceneEnabled(timeline.scenes, phase.sceneId),
  );
}

function isSceneEnabled(
  scenes: readonly Pick<EffectScene, "id" | "enabled">[] = [],
  sceneId: string | null | undefined = null,
) {
  if (!sceneId) {
    return true;
  }
  const scene = scenes.find((item) => item.id === sceneId);
  return !scene || scene.enabled !== false;
}

export function getDefaultLayerProperty(
  layer: Record<string, unknown>,
  property: string,
): number {
  const value = layer[property];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return property === "opacity" ||
    property === "scaleX" ||
    property === "scaleY"
    ? 1
    : 0;
}
