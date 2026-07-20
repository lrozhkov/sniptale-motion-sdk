import {
  keyframeRefKey,
  type KeyframeTimeSnapshot,
} from "../timeline/model/keyframe-transform.js";

export function applyGraphTimePlan(
  timeline,
  snapshot: KeyframeTimeSnapshot,
  plan,
): void {
  for (const entry of snapshot.entries) {
    const track = timeline.tracks.find((item) => item.id === entry.trackId);
    const keyframe = track?.keyframes.find(
      (item) => item.id === entry.keyframeId,
    );
    if (keyframe) {
      keyframe.time = plan.updates[keyframeRefKey(entry)];
    }
  }
  for (const track of timeline.tracks) {
    track.keyframes.sort((left, right) => left.time - right.time);
  }
}

export function commitInteractiveGraphTimeline(ctx, template, timeline): void {
  ctx.state.timelineOverrides.set(
    template.id,
    ctx.deps.normalizeTimeline(timeline, ctx.getEffectiveDuration(template)),
  );
}

export function getGraphPointer(svg, event) {
  return createGraphPointerMapper(svg)(event);
}

export function createGraphPointerMapper(svg) {
  const rect = svg.getBoundingClientRect();
  const viewBox = svg.viewBox.baseVal;
  const inverse = svg.getScreenCTM?.()?.inverse?.() ?? null;
  const metrics = {
    height: viewBox.height,
    left: rect.left,
    top: rect.top,
    width: viewBox.width,
    viewportHeight: rect.height,
    viewportWidth: rect.width,
  };
  return (event) =>
    inverse
      ? {
          x: inverse.a * event.clientX + inverse.c * event.clientY + inverse.e,
          y: inverse.b * event.clientX + inverse.d * event.clientY + inverse.f,
        }
      : {
          x:
            ((event.clientX - metrics.left) /
              Math.max(1, metrics.viewportWidth)) *
            metrics.width,
          y:
            ((event.clientY - metrics.top) /
              Math.max(1, metrics.viewportHeight)) *
            metrics.height,
        };
}

export function clampGraphTimeViewport(viewport, duration): void {
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

export function clampGraphValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
