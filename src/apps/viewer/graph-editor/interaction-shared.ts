import type { ViewerAppContext } from "../app/context.js";
import type { EditorTimelineSource } from "../editor/timeline-source.js";
import type { GraphEditorViewport } from "./state.js";
import type { EditorTimeline } from "../editor/model-types.js";
import { type KeyframeTimePlan } from "../timeline/model/keyframe-transform.js";

export function applyGraphTimePlan(
  timeline: EditorTimeline,
  plan: Extract<KeyframeTimePlan, { ok: true }>,
): void {
  for (const entry of plan.updates) {
    const track = timeline.tracks.find((item) => item.id === entry.trackId);
    const keyframe = track?.keyframes.find(
      (item) => item.id === entry.keyframeId,
    );
    if (keyframe) {
      keyframe.time = entry.time;
    }
  }
  for (const track of timeline.tracks) {
    track.keyframes.sort((left, right) => left.time - right.time);
  }
}

export function commitInteractiveGraphTimeline(
  ctx: ViewerAppContext,
  template: EditorTimelineSource,
  timeline: EditorTimeline,
): void {
  ctx.state.timelineOverrides.set(
    template.id,
    ctx.deps.normalizeTimeline(timeline, ctx.getEffectiveDuration(template)),
  );
}

export function clampGraphTimeViewport(
  viewport: GraphEditorViewport,
  duration: number,
): void {
  const span = viewport.timeEnd - viewport.timeStart;
  if (viewport.timeStart < 0) {
    viewport.timeStart = 0;
    viewport.timeEnd = span;
  }
  if (viewport.timeEnd > duration) {
    viewport.timeEnd = duration;
    viewport.timeStart = Math.max(0, duration - span);
  }
}

export function clampGraphValue(
  value: number,
  min: number,
  max: number,
): number {
  return Math.min(max, Math.max(min, value));
}
