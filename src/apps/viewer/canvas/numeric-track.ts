import type { ViewerAppContext } from "../app/context.js";
import { resolveTimelineEase } from "../../../sdk/timeline/easing.js";
import { resolveViewerMotionPathTrackValue } from "./motion-path-resolver.js";

export function resolveNumericTrack(
  ctx: ViewerAppContext,
  track,
  time,
  fallback,
  timeline = null,
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
  const keyframes = Array.isArray(track?.keyframes)
    ? track.keyframes.filter(
        (item) =>
          item.enabled !== false &&
          typeof item.value === "number" &&
          isTimelineOwnerEnabled(timeline, item.sceneId, item.phaseId),
      )
    : [];
  if (keyframes.length === 0) {
    return fallback;
  }
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  if (time <= sorted[0].time) {
    return sorted[0].value;
  }
  const last = sorted[sorted.length - 1];
  if (time >= last.time) {
    return last.value;
  }
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const from = sorted[index];
    const to = sorted[index + 1];
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

function isTimelineOwnerEnabled(timeline, sceneId, phaseId) {
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

function isSceneEnabled(scenes: any[] = [], sceneId = null) {
  if (!sceneId) {
    return true;
  }
  const scene = scenes.find((item) => item.id === sceneId);
  return !scene || scene.enabled !== false;
}
