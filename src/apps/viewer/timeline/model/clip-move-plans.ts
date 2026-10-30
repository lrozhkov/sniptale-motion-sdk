import type { ViewerAppContext } from "../../app/context.js";

function createClipMovePlan(
  ctx: ViewerAppContext,
  effectiveTemplate,
  layerIds,
  totalDuration,
  includeLinkedKeys = true,
) {
  const selected = new Set(layerIds);
  const clips = ctx.deps.deepClone(effectiveTemplate?.clips ?? []);
  const timeline = ctx.deps.deepClone(
    effectiveTemplate?.timeline ?? { phases: [], tracks: [] },
  );
  const movablePhaseIds = includeLinkedKeys
    ? ctx.getClipMovablePhaseIds(timeline, clips, selected)
    : new Set();
  const clipItems = clips
    .filter((clip) => selected.has(clip.layerId) && !clip.locked)
    .map((clip) => ({
      clip,
      duration: Number(clip.duration) || 0.05,
      layerId: clip.layerId,
      start: Number(clip.start) || 0,
    }));
  const windows = clipItems.map((item) => ({
    end: item.start + item.duration,
    layerId: item.layerId,
    sceneId: item.clip.sceneId ?? null,
    start: item.start,
  }));
  const scenesById = new Map<string, any>(
    (effectiveTemplate?.scenes ?? []).map((scene) => [scene.id, scene]),
  );
  const keyframeItems = [];
  const phaseItems = [];
  const bounds = [];
  const sceneBounds = new Map<string, any>();
  const minDeltas = [];
  const maxDeltas = [];
  const addBound = (start, end = start, sceneId = null) => {
    bounds.push({ end, start });
    if (!sceneId) {
      return;
    }
    const scene = scenesById.get(sceneId);
    if (!scene) {
      return;
    }
    const sceneStart = Number(scene.start) || 0;
    const sceneEnd = sceneStart + (Number(scene.duration) || 0);
    const existing = sceneBounds.get(sceneId) ?? {
      maxEnd: end,
      minStart: start,
      sceneEnd,
      sceneStart,
    };
    existing.minStart = Math.min(existing.minStart, start);
    existing.maxEnd = Math.max(existing.maxEnd, end);
    sceneBounds.set(sceneId, existing);
  };
  clipItems.forEach((item) => {
    addBound(item.start, item.start + item.duration, item.clip.sceneId ?? null);
  });
  if (includeLinkedKeys) {
    const seenKeyframes = new Set();
    const seenPhases = new Set();
    (timeline.tracks ?? []).forEach((track) => {
      const layerId = ctx.getTrackLayerId(track);
      if (!layerId || !selected.has(layerId)) {
        return;
      }
      const window = windows.find((item) => item.layerId === layerId);
      (track.keyframes ?? []).forEach((keyframe) => {
        const time = Number(keyframe.time) || 0;
        const key = `${track.id}:${keyframe.id}`;
        if (
          seenKeyframes.has(key) ||
          (window && !ctx.isTimeInsideRange(time, window.start, window.end)) ||
          (window &&
            !ctx.keyframeCanMoveWithClip(timeline, track, keyframe, window))
        ) {
          return;
        }
        seenKeyframes.add(key);
        keyframeItems.push({
          keyframe,
          keyframeId: keyframe.id,
          time,
          track,
          trackId: track.id,
        });
        addBound(time, time, window?.sceneId ?? track.sceneId ?? null);
        const phaseId = keyframe.phaseId ?? track.phaseId;
        const phase = (timeline.phases ?? []).find(
          (item) => item.id === phaseId,
        );
        if (
          phase &&
          !phase.locked &&
          movablePhaseIds.has(phase.id) &&
          !seenPhases.has(phase.id)
        ) {
          seenPhases.add(phase.id);
          phaseItems.push({
            duration: Number(phase.duration) || 0.05,
            phase,
            phaseId: phase.id,
            start: Number(phase.start) || 0,
          });
          addBound(
            Number(phase.start) || 0,
            (Number(phase.start) || 0) + (Number(phase.duration) || 0),
            phase.sceneId ?? window?.sceneId ?? null,
          );
        }
      });
    });
  }
  sceneBounds.forEach((item) => {
    minDeltas.push(item.sceneStart - item.minStart);
    maxDeltas.push(item.sceneEnd - item.maxEnd);
  });
  const minStart = bounds.length
    ? Math.min(...bounds.map((item) => item.start))
    : 0;
  const maxEnd = bounds.length
    ? Math.max(...bounds.map((item) => item.end))
    : totalDuration;
  minDeltas.push(-minStart);
  maxDeltas.push(totalDuration - maxEnd);
  return {
    clipItems,
    clips,
    keyframeItems,
    maxDelta: Math.min(...maxDeltas),
    minDelta: Math.max(...minDeltas),
    phaseItems,
    timeline,
  };
}

function keyframeCanMoveWithClip(
  ctx: ViewerAppContext,
  timeline,
  track,
  keyframe,
  clipOrWindow,
) {
  const clipSceneId = clipOrWindow?.sceneId ?? null;
  if (!clipSceneId) {
    return true;
  }
  const keySceneId = ctx.getKeyframeOwnershipSceneId(timeline, track, keyframe);
  return !keySceneId || keySceneId === clipSceneId;
}

function keyframePhaseCanMoveWithClip(
  ctx: ViewerAppContext,
  timeline,
  track,
  keyframe,
  movablePhaseIds,
) {
  const phaseId = keyframe?.phaseId ?? track?.phaseId;
  return !phaseId || movablePhaseIds.has(phaseId);
}

function getClipMovablePhaseIds(
  ctx: ViewerAppContext,
  timeline,
  clips,
  selectedLayerIds,
) {
  const explicitPhaseIds = new Set(
    (timeline.phases ?? []).map((phase) => phase.id),
  );
  const phaseOwners = new Map();
  for (const track of timeline.tracks ?? []) {
    const layerId = ctx.getTrackLayerId(track);
    for (const keyframe of track.keyframes ?? []) {
      const phaseId = keyframe.phaseId ?? track.phaseId;
      if (!phaseId || !explicitPhaseIds.has(phaseId)) {
        continue;
      }
      if (!phaseOwners.has(phaseId)) {
        phaseOwners.set(phaseId, new Set());
      }
      phaseOwners.get(phaseId).add(layerId ?? "__scene__");
    }
  }
  const movable = new Set();
  for (const [phaseId, owners] of phaseOwners) {
    if ([...owners].every((owner) => selectedLayerIds.has(owner))) {
      movable.add(phaseId);
    }
  }
  for (const clip of clips ?? []) {
    if (selectedLayerIds.has(clip.layerId)) {
      const layerPhaseIds = [...phaseOwners.entries()]
        .filter(([, owners]) => owners.size === 1 && owners.has(clip.layerId))
        .map(([phaseId]) => phaseId);
      layerPhaseIds.forEach((phaseId) => movable.add(phaseId));
    }
  }
  return movable;
}

function applyClipMovePlan(
  ctx: ViewerAppContext,
  template,
  plan,
  deltaTime,
  options: any = {},
) {
  if (!template || !plan) {
    return;
  }
  const totalDuration = ctx.getEffectiveDuration(template);
  const delta =
    ctx.snapDuration(Math.abs(deltaTime)) * Math.sign(deltaTime || 0);
  plan.clipItems.forEach((item) => {
    item.clip.start = ctx.snapTime(
      ctx.deps.clamp(item.start + delta, 0, totalDuration - item.duration),
    );
  });
  plan.keyframeItems.forEach((item) => {
    item.keyframe.time = ctx.snapTime(
      ctx.deps.clamp(item.time + delta, 0, totalDuration),
    );
  });
  plan.phaseItems?.forEach((item) => {
    item.phase.start = ctx.snapTime(
      ctx.deps.clamp(item.start + delta, 0, totalDuration - item.duration),
    );
  });
  (plan.timeline.tracks ?? []).forEach((track) => {
    track.keyframes = [...(track.keyframes ?? [])].sort(
      (a, b) => a.time - b.time,
    );
  });
  ctx.setEditorOverride({ clips: plan.clips });
  ctx.state.timelineOverrides.set(
    template.id,
    ctx.deps.normalizeTimeline(plan.timeline, totalDuration),
  );
  if (options.render === false) {
    return;
  }
  ctx.renderTimelineEditor(template);
  void ctx.renderCurrentFrame();
}

export function installModelClipMovePlansOwner(ctx: ViewerAppContext): void {
  ctx.createClipMovePlan = createClipMovePlan.bind(undefined, ctx);
  ctx.keyframeCanMoveWithClip = keyframeCanMoveWithClip.bind(undefined, ctx);
  ctx.keyframePhaseCanMoveWithClip = keyframePhaseCanMoveWithClip.bind(
    undefined,
    ctx,
  );
  ctx.getClipMovablePhaseIds = getClipMovablePhaseIds.bind(undefined, ctx);
  ctx.applyClipMovePlan = applyClipMovePlan.bind(undefined, ctx);
}
