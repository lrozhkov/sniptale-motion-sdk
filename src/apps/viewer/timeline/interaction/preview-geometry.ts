import type {
  EffectClip,
  EffectScene,
  TimelinePhase,
} from "../../../../sdk/types.js";
import type { EditorTimeline } from "../../editor/model-types.js";
import type { EditorTimelineSource } from "../../editor/timeline-source.js";
import type { ViewerAppContext } from "../../app/context.js";

export function syncTimelineInteractionGeometry(
  ctx: ViewerAppContext,
  template: EditorTimelineSource,
  timeline: EditorTimeline,
): void {
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  if (!effectiveTemplate) {
    return;
  }
  const duration = ctx.getEffectiveDuration(template);
  const scenes = ctx.normalizeScenes(effectiveTemplate.scenes ?? [], duration);
  const sceneById = new Map(scenes.map((scene) => [scene.id, scene]));
  const clipByLayerId = new Map(
    (effectiveTemplate.clips ?? []).map((clip) => [clip.layerId, clip]),
  );
  const phaseById = new Map(
    (timeline.phases ?? []).map((phase) => [phase.id, phase]),
  );
  const trackById = new Map(
    (timeline.tracks ?? []).map((track) => [track.id, track]),
  );

  for (const element of timelineElements(ctx, ".scene-block[data-scene-id]")) {
    const scene = sceneById.get(element.dataset.sceneId ?? "");
    if (scene) {
      setTimelineRange(ctx, element, scene.start, scene.duration, duration);
    }
  }

  for (const element of timelineElements(ctx, ".clip-block[data-layer-id]")) {
    const clip = clipByLayerId.get(element.dataset.layerId ?? "");
    if (!clip) {
      continue;
    }
    const parentSceneId =
      element.closest<HTMLElement>(".timeline-lane")?.dataset.parentSceneId;
    const interval = resolveClipPreviewInterval(
      ctx,
      clip,
      parentSceneId ? sceneById.get(parentSceneId) : null,
      duration,
    );
    setTimelineRange(
      ctx,
      element,
      interval.effectiveStart,
      interval.effectiveEnd - interval.effectiveStart,
      duration,
    );
    syncDatasetValue(element, "rawStart", interval.rawStart);
    syncDatasetValue(element, "rawEnd", interval.rawEnd);
    syncDatasetValue(element, "effectiveStart", interval.effectiveStart);
    syncDatasetValue(element, "effectiveEnd", interval.effectiveEnd);
  }

  for (const element of timelineElements(ctx, ".phase-block[data-phase-id]")) {
    const phase = phaseById.get(element.dataset.phaseId ?? "");
    if (!phase) {
      continue;
    }
    const layerId =
      element.closest<HTMLElement>(".timeline-lane")?.dataset.layerId;
    const bounds = resolvePhasePreviewBounds(ctx, timeline, phase, layerId);
    setTimelineRange(ctx, element, bounds.start, bounds.duration, duration);
  }

  for (const element of timelineElements(
    ctx,
    ".keyframe-point[data-track-id][data-keyframe-id]",
  )) {
    const track = trackById.get(element.dataset.trackId ?? "");
    const keyframe = track?.keyframes?.find(
      (item) => item.id === element.dataset.keyframeId,
    );
    if (!keyframe) {
      continue;
    }
    setStyleValue(
      element,
      "left",
      `${ctx.timelinePercent(keyframe.time, duration)}%`,
    );
    element.classList.toggle(
      "edge-start",
      Math.abs(Number(keyframe.time)) < 0.0001,
    );
    element.classList.toggle(
      "edge-end",
      Math.abs(Number(keyframe.time) - Number(duration)) < 0.0001,
    );
  }

  for (const element of timelineElements(
    ctx,
    ".keyframe-segment-range[data-track-id]",
  )) {
    const track = trackById.get(element.dataset.trackId ?? "");
    const from = track?.keyframes?.find(
      (item) => item.id === element.dataset.fromKeyframeId,
    );
    const to = track?.keyframes?.find(
      (item) => item.id === element.dataset.toKeyframeId,
    );
    if (from && to) {
      setTimelineRange(
        ctx,
        element,
        from.time,
        to.time - from.time,
        duration,
        0.2,
      );
    }
  }
}

function resolveClipPreviewInterval(
  ctx: ViewerAppContext,
  clip: EffectClip,
  scene: EffectScene | null | undefined,
  duration: number,
) {
  if (scene) {
    return ctx.getSceneClampedClipInterval(clip, scene);
  }
  const rawStart = Number(clip.start) || 0;
  const rawEnd = rawStart + (Number(clip.duration) || 0);
  const effectiveStart = ctx.deps.clamp(rawStart, 0, duration);
  const effectiveEnd = Math.max(
    effectiveStart + 0.001,
    ctx.deps.clamp(rawEnd, effectiveStart, duration),
  );
  return { effectiveEnd, effectiveStart, rawEnd, rawStart };
}

function resolvePhasePreviewBounds(
  ctx: ViewerAppContext,
  timeline: EditorTimeline,
  phase: TimelinePhase,
  layerId: string | undefined,
) {
  const start = Number(phase.start);
  const duration = Number(phase.duration);
  if (Number.isFinite(start) && Number.isFinite(duration) && duration > 0) {
    return { duration, start };
  }
  const times: number[] = [];
  for (const track of timeline.tracks ?? []) {
    if (layerId && ctx.getTrackLayerId(track) !== layerId) {
      continue;
    }
    for (const keyframe of track.keyframes ?? []) {
      if ((keyframe.phaseId ?? track.phaseId ?? null) !== phase.id) {
        continue;
      }
      const time = Number(keyframe.time);
      if (Number.isFinite(time)) {
        times.push(time);
      }
    }
  }
  if (times.length > 0) {
    const derivedStart = Math.min(...times);
    return {
      duration: Math.max(0.05, Math.max(...times) - derivedStart),
      start: derivedStart,
    };
  }
  return {
    duration: 0.05,
    start: Number.isFinite(start) ? start : 0,
  };
}

function setTimelineRange(
  ctx: ViewerAppContext,
  element: HTMLElement,
  start: number,
  duration: number,
  totalDuration: number,
  minimumWidth = 0.4,
): void {
  setStyleValue(
    element,
    "left",
    `${ctx.timelinePercent(start, totalDuration)}%`,
  );
  setStyleValue(
    element,
    "width",
    `${Math.max(
      minimumWidth,
      ctx.timelineDurationPercent(duration, totalDuration),
    )}%`,
  );
}

function timelineElements(
  ctx: ViewerAppContext,
  selector: string,
): HTMLElement[] {
  return Array.from(ctx.refs.timelineTracks.querySelectorAll(selector)).filter(
    (element): element is HTMLElement => element instanceof HTMLElement,
  );
}

function setStyleValue(
  element: HTMLElement,
  property: "left" | "width",
  value: string,
): void {
  if (element.style[property] !== value) {
    element.style[property] = value;
  }
}

function syncDatasetValue(
  element: HTMLElement,
  property: string,
  value: unknown,
): void {
  const next = String(value);
  if (element.dataset[property] !== next) {
    element.dataset[property] = next;
  }
}
