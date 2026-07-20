import type { ViewerAppContext } from "../../app/context.js";

function clipBelongsToScene(ctx: ViewerAppContext, clip, scene) {
  if (typeof clip?.sceneId === "string") {
    return clip.sceneId === scene.id;
  }
  return ctx.timeBelongsToScene(Number(clip?.start) || 0, scene);
}

function isGlobalTimelineClip(ctx: ViewerAppContext, clip, scenes) {
  if (typeof clip?.sceneId === "string" || scenes.length <= 1) {
    return false;
  }
  const start = Number(clip?.start) || 0;
  const duration = Number(clip?.duration) || 0;
  return !scenes.some((scene) =>
    ctx.isRangeInsideScene(start, duration, scene),
  );
}

function getGlobalTimelineLayerIds(
  ctx: ViewerAppContext,
  template,
  scenes = ctx.normalizeScenes(
    template?.scenes ?? [],
    Number(template?.duration) || 0,
  ),
) {
  return new Set<string>(
    (template?.clips ?? [])
      .filter((clip) => ctx.isGlobalTimelineClip(clip, scenes))
      .map((clip) => clip.layerId),
  );
}

function phaseBelongsToScene(ctx: ViewerAppContext, phase, scene) {
  if (typeof phase?.sceneId === "string") {
    return phase.sceneId === scene.id;
  }
  return ctx.timeBelongsToScene(Number(phase?.start) || 0, scene);
}

function keyframeBelongsToScene(
  ctx: ViewerAppContext,
  track,
  keyframe,
  scene,
  timeline = ctx.getEffectiveTimeline(ctx.state.currentTemplate),
) {
  const sceneId = ctx.getKeyframeOwnershipSceneId(timeline, track, keyframe);
  if (sceneId) {
    return sceneId === scene.id;
  }
  const time = Number(keyframe?.time) || 0;
  if (ctx.timeBelongsToScene(time, scene)) {
    return true;
  }
  const compositionEnd = ctx.getEffectiveDuration(ctx.state.currentTemplate);
  const sceneEnd = (Number(scene?.start) || 0) + Number(scene?.duration || 0);
  return (
    Math.abs(time - compositionEnd) < 0.0001 &&
    Math.abs(sceneEnd - compositionEnd) < 0.0001
  );
}

function timeBelongsToScene(ctx: ViewerAppContext, time, scene) {
  const sceneStart = Number(scene.start) || 0;
  const sceneEnd = sceneStart + Number(scene.duration || 0);
  return time >= sceneStart - 0.0001 && time < sceneEnd - 0.0001;
}

function keyframeLinkKey(ctx: ViewerAppContext, trackId, keyframeId) {
  return `${trackId}:${keyframeId}`;
}

function keyframeBelongsToSelectedPhase(
  ctx: ViewerAppContext,
  keyframe,
  track,
  selectedPhaseIds,
) {
  if (typeof keyframe?.phaseId === "string") {
    return selectedPhaseIds.has(keyframe.phaseId);
  }
  return (
    typeof track?.phaseId === "string" && selectedPhaseIds.has(track.phaseId)
  );
}

function timingBelongsToSelectedScene(
  ctx: ViewerAppContext,
  item,
  fallbackTime,
  windows,
  selectedSceneIds,
  parentSceneId = null,
) {
  const sceneId =
    typeof item?.sceneId === "string" ? item.sceneId : parentSceneId;
  if (sceneId) {
    return selectedSceneIds.has(sceneId);
  }
  return ctx.isTimeInsideAnyScene(Number(fallbackTime) || 0, windows);
}

function inferTrackProperty(ctx: ViewerAppContext, track) {
  if (typeof track?.property === "string") {
    return track.property;
  }
  if (typeof track?.id === "string" && track.id.includes(".")) {
    return track.id.split(".").slice(1).join(".");
  }
  return null;
}

function getPhaseTrackLayerIds(ctx: ViewerAppContext, timeline, phaseId) {
  const owners = new Set<string>();
  for (const track of timeline?.tracks ?? []) {
    if (track?.phaseId === phaseId) {
      owners.add(ctx.getTrackLayerId(track) ?? "__scene__");
      continue;
    }
    if (
      (track?.keyframes ?? []).some((keyframe) => keyframe?.phaseId === phaseId)
    ) {
      owners.add(ctx.getTrackLayerId(track) ?? "__scene__");
    }
  }
  return owners;
}

function isPhaseCompatibleWithLayer(
  ctx: ViewerAppContext,
  timeline,
  phaseId,
  layerId,
) {
  if (!phaseId) {
    return true;
  }
  const owners = ctx.getPhaseTrackLayerIds(timeline, phaseId);
  if (owners.size === 0) {
    return true;
  }
  return owners.has(layerId ?? "__scene__");
}

export function installTimelineOwnershipPredicatesOwner(
  ctx: ViewerAppContext,
): void {
  ctx.clipBelongsToScene = (...args: any[]) =>
    (clipBelongsToScene as any)(ctx, ...args);
  ctx.isGlobalTimelineClip = (...args: any[]) =>
    (isGlobalTimelineClip as any)(ctx, ...args);
  ctx.getGlobalTimelineLayerIds = (...args: any[]) =>
    (getGlobalTimelineLayerIds as any)(ctx, ...args);
  ctx.phaseBelongsToScene = (...args: any[]) =>
    (phaseBelongsToScene as any)(ctx, ...args);
  ctx.keyframeBelongsToScene = (...args: any[]) =>
    (keyframeBelongsToScene as any)(ctx, ...args);
  ctx.timeBelongsToScene = (...args: any[]) =>
    (timeBelongsToScene as any)(ctx, ...args);
  ctx.keyframeLinkKey = (...args: any[]) =>
    (keyframeLinkKey as any)(ctx, ...args);
  ctx.keyframeBelongsToSelectedPhase = (...args: any[]) =>
    (keyframeBelongsToSelectedPhase as any)(ctx, ...args);
  ctx.timingBelongsToSelectedScene = (...args: any[]) =>
    (timingBelongsToSelectedScene as any)(ctx, ...args);
  ctx.inferTrackProperty = (...args: any[]) =>
    (inferTrackProperty as any)(ctx, ...args);
  ctx.getPhaseTrackLayerIds = (...args: any[]) =>
    (getPhaseTrackLayerIds as any)(ctx, ...args);
  ctx.isPhaseCompatibleWithLayer = (...args: any[]) =>
    (isPhaseCompatibleWithLayer as any)(ctx, ...args);
}
