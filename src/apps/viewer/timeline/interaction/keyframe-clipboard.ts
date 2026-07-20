import type { ViewerAppContext } from "../../app/context.js";
import {
  duplicateInsertedMotionPathPoints,
  removeDeletedMotionPathPoints,
} from "../model/motion-path-mutations.js";

type ClipboardEntry = {
  keyframe: any;
  trackId: string;
};

function copySelectedKeyframes(ctx: ViewerAppContext): boolean {
  const template = ctx.state.currentTemplate;
  const timeline = ctx.getEffectiveTimeline(template);
  const refs = ctx.getSelectedKeyframeRefs();
  if (!template || refs.length === 0) {
    return false;
  }
  const clipboard = refs.map((ref) => {
    const track = timeline.tracks.find((item) => item.id === ref.trackId);
    const keyframe = track?.keyframes.find(
      (item) => item.id === ref.keyframeId,
    );
    return track && keyframe
      ? { keyframe: ctx.deps.deepClone(keyframe), trackId: track.id }
      : null;
  });
  if (clipboard.some((entry) => !entry)) {
    return false;
  }
  ctx.state.keyframeClipboard = clipboard;
  return true;
}

function pasteKeyframesAtPlayhead(ctx: ViewerAppContext): boolean {
  const playhead = Number(ctx.refs.timeSlider.value) || 0;
  return insertKeyframeClipboard(ctx, ctx.state.keyframeClipboard ?? [], {
    mode: "paste",
    requestedStart: playhead,
  });
}

function duplicateSelectedKeyframes(ctx: ViewerAppContext): boolean {
  const template = ctx.state.currentTemplate;
  const timeline = ctx.getEffectiveTimeline(template);
  const refs = ctx.getSelectedKeyframeRefs();
  if (!template || refs.length === 0) {
    return false;
  }
  const clipboard = refs.map((ref) => {
    const track = timeline.tracks.find((item) => item.id === ref.trackId);
    const keyframe = track?.keyframes.find(
      (item) => item.id === ref.keyframeId,
    );
    return track && keyframe
      ? { keyframe: ctx.deps.deepClone(keyframe), trackId: track.id }
      : null;
  });
  if (clipboard.some((entry) => !entry)) {
    return false;
  }
  const firstTime = Math.min(...clipboard.map((entry) => entry.keyframe.time));
  const frameDuration = getFrameDuration(ctx);
  return insertKeyframeClipboard(ctx, clipboard, {
    mode: "duplicate",
    requestedStart: firstTime + frameDuration,
  });
}

function deleteSelectedKeyframes(ctx: ViewerAppContext): boolean {
  const template = ctx.state.currentTemplate;
  const refs = ctx.getSelectedKeyframeRefs();
  if (!template || refs.length === 0) {
    return false;
  }
  const timeline = ctx.getEffectiveTimeline(template);
  const selectedKeys = new Set<string>(
    refs.map((ref) => `${ref.trackId}:${ref.keyframeId}`),
  );
  const existingCount = timeline.tracks.reduce(
    (count, track) =>
      count +
      track.keyframes.filter((keyframe) =>
        selectedKeys.has(`${track.id}:${keyframe.id}`),
      ).length,
    0,
  );
  if (existingCount !== refs.length) {
    return false;
  }
  ctx.beginEditorCommand({
    payload: { keyframes: refs },
    type: "deleteKeyframes",
  });
  for (const track of timeline.tracks) {
    track.keyframes = track.keyframes.filter(
      (keyframe) => !selectedKeys.has(`${track.id}:${keyframe.id}`),
    );
  }
  timeline.motionPaths = removeDeletedMotionPathPoints(timeline, selectedKeys);
  commitKeyframeTimeline(ctx, template, timeline, []);
  return true;
}

function insertKeyframeClipboard(
  ctx: ViewerAppContext,
  clipboard: ClipboardEntry[],
  options: { mode: "duplicate" | "paste"; requestedStart: number },
): boolean {
  const template = ctx.state.currentTemplate;
  if (!template || clipboard.length === 0) {
    return false;
  }
  const timeline = ctx.getEffectiveTimeline(template);
  const validTrackIds = new Set(timeline.tracks.map((track) => track.id));
  if (clipboard.some((entry) => !validTrackIds.has(entry.trackId))) {
    return reportKeyframePlacementFailure(ctx);
  }
  const firstTime = Math.min(
    ...clipboard.map((entry) => Number(entry.keyframe.time) || 0),
  );
  const duration = ctx.getEffectiveDuration(template);
  const offset = findCollisionFreeKeyframeOffset(
    timeline,
    clipboard,
    options.requestedStart - firstTime,
    duration,
    getFrameDuration(ctx),
  );
  if (offset === null) {
    return reportKeyframePlacementFailure(ctx);
  }
  ctx.beginEditorCommand({
    payload: {
      keyframes: clipboard.map((entry) => ({
        keyframeId: entry.keyframe.id,
        trackId: entry.trackId,
      })),
      offset,
    },
    type:
      options.mode === "duplicate" ? "duplicateKeyframes" : "pasteKeyframes",
  });
  const inserted = [];
  const insertedMappings = [];
  for (const entry of clipboard) {
    const track = timeline.tracks.find((item) => item.id === entry.trackId);
    const next = ctx.deps.deepClone(entry.keyframe);
    next.time = ctx.snapTime(
      ctx.deps.clamp(Number(entry.keyframe.time) + offset, 0, duration),
    );
    next.id = ctx.createKeyframeId(
      timeline,
      track.id,
      options.mode === "duplicate" ? "duplicate" : "pasted",
      next.time,
    );
    ctx.assignKeyframeOwnershipAtTime(next, track, next.time);
    track.keyframes.push(next);
    track.keyframes.sort((left, right) => left.time - right.time);
    inserted.push({ keyframeId: next.id, trackId: track.id });
    insertedMappings.push({
      fromKeyframeId: entry.keyframe.id,
      toKeyframeId: next.id,
      trackId: track.id,
    });
  }
  timeline.motionPaths = duplicateInsertedMotionPathPoints(
    timeline,
    insertedMappings,
  );
  commitKeyframeTimeline(ctx, template, timeline, inserted);
  return true;
}

export function findCollisionFreeKeyframeOffset(
  timeline,
  clipboard: ClipboardEntry[],
  preferredOffset: number,
  duration: number,
  frameDuration: number,
): number | null {
  const step = Math.max(0.001, Number(frameDuration) || 1 / 30);
  const attempts = Math.ceil(Math.max(1, duration) / step);
  for (let index = 0; index <= attempts; index += 1) {
    for (const direction of index === 0 ? [0] : [1, -1]) {
      const offset = preferredOffset + index * step * direction;
      if (canPlaceKeyframes(timeline, clipboard, offset, duration, step)) {
        return offset;
      }
    }
  }
  return null;
}

function canPlaceKeyframes(
  timeline,
  clipboard,
  offset,
  duration,
  frameDuration,
): boolean {
  const epsilon = Math.min(0.0001, frameDuration * 0.1);
  const plannedByTrack = new Map<string, number[]>();
  for (const entry of clipboard) {
    const time = Number(entry.keyframe.time) + offset;
    if (time < -epsilon || time > duration + epsilon) {
      return false;
    }
    const planned = plannedByTrack.get(entry.trackId) ?? [];
    if (planned.some((candidate) => Math.abs(candidate - time) <= epsilon)) {
      return false;
    }
    planned.push(time);
    plannedByTrack.set(entry.trackId, planned);
    const track = timeline.tracks.find((item) => item.id === entry.trackId);
    if (
      track.keyframes.some(
        (keyframe) => Math.abs(Number(keyframe.time) - time) <= epsilon,
      )
    ) {
      return false;
    }
  }
  return true;
}

function commitKeyframeTimeline(ctx, template, timeline, refs): void {
  ctx.state.timelineOverrides.set(
    template.id,
    ctx.deps.normalizeTimeline(timeline, ctx.getEffectiveDuration(template)),
  );
  ctx.setSelectedKeyframes(refs, { render: false });
  if (refs.length > 0) {
    ctx.setSidebarGroup("inspect");
  }
  ctx.renderTimelineEditor(template);
  void ctx.renderCurrentFrame();
}

function getFrameDuration(ctx): number {
  return 1 / Math.max(1, Number(ctx.refs.fpsInput.value) || 30);
}

function reportKeyframePlacementFailure(ctx): false {
  ctx.logDiagnostic(
    ctx.deps.t(
      "viewer.timeline.keyframePlacementUnavailable",
      "There is no collision-free space for these keyframes.",
    ),
    "error",
  );
  return false;
}

export function installInteractionKeyframeClipboardOwner(
  ctx: ViewerAppContext,
): void {
  ctx.copySelectedKeyframes = (...args: any[]) =>
    (copySelectedKeyframes as any)(ctx, ...args);
  ctx.pasteKeyframesAtPlayhead = (...args: any[]) =>
    (pasteKeyframesAtPlayhead as any)(ctx, ...args);
  ctx.duplicateSelectedKeyframes = (...args: any[]) =>
    (duplicateSelectedKeyframes as any)(ctx, ...args);
  ctx.deleteSelectedKeyframes = (...args: any[]) =>
    (deleteSelectedKeyframes as any)(ctx, ...args);
}
