import type { ViewerAppContext } from "../../app/context.js";

function getKeyframeOwnershipSceneId(
  ctx: ViewerAppContext,
  timeline,
  track,
  keyframe,
) {
  if (typeof keyframe?.sceneId === "string") {
    return keyframe.sceneId;
  }
  if (typeof track?.sceneId === "string") {
    return track.sceneId;
  }
  const phaseId =
    typeof keyframe?.phaseId === "string" ? keyframe.phaseId : track?.phaseId;
  const phase = (timeline?.phases ?? []).find((item) => item.id === phaseId);
  return typeof phase?.sceneId === "string" ? phase.sceneId : null;
}

function markOwnershipLink(ctx: ViewerAppContext, element, linked) {
  element.classList.toggle("ownership-linked", Boolean(linked));
  if (linked) {
    element.dataset.ownershipLinked = "true";
  } else {
    delete element.dataset.ownershipLinked;
  }
}

function createEmptyOwnershipLinks(ctx: ViewerAppContext) {
  return {
    clipLayerIds: new Set(),
    keyframes: new Set(),
    phaseIds: new Set(),
    sceneIds: new Set(),
    trackIds: new Set(),
  };
}

function buildSelectedOwnershipLinks(ctx: ViewerAppContext, template) {
  const links = ctx.createEmptyOwnershipLinks();
  const item = ctx.state.selectedItem ?? { type: "effect" };
  if (!template || item.type === "effect") {
    return links;
  }
  if (
    !ctx.state.moveLinkedKeys &&
    (item.type === "scene" || item.type === "clip" || item.type === "phase")
  ) {
    if (item.type === "scene") {
      links.sceneIds.add(item.sceneId);
    } else if (item.type === "clip") {
      links.clipLayerIds.add(item.layerId);
    } else if (item.type === "phase") {
      links.phaseIds.add(item.phaseId);
    }
    return links;
  }
  if (item.type === "scene") {
    ctx.collectSceneOwnershipLinks(template, [item.sceneId], links);
  } else if (item.type === "clip") {
    ctx.collectClipOwnershipLinks(template, [item.layerId], links);
  } else if (item.type === "layer") {
    for (const track of template.timeline?.tracks ?? []) {
      if (ctx.getTrackLayerId(track) === item.layerId) {
        links.trackIds.add(track.id);
      }
    }
  } else if (item.type === "phase") {
    ctx.collectPhaseOwnershipLinks(template, [item.phaseId], links);
  } else if (item.type === "track") {
    ctx.collectTrackOwnershipLinks(template, item.trackId, links);
  } else if (item.type === "keyframe") {
    ctx.collectKeyframeParentLinks(
      template,
      item.trackId,
      item.keyframeId,
      links,
    );
  }
  return links;
}

function collectSceneOwnershipLinks(
  ctx: ViewerAppContext,
  template,
  sceneIds,
  links,
) {
  const selected = new Set(sceneIds);
  const scenes = ctx.normalizeScenes(template.scenes ?? [], template.duration);
  const globalLayerIds = ctx.getGlobalTimelineLayerIds(template, scenes);
  const windows = scenes
    .filter((scene) => selected.has(scene.id))
    .map((scene) => ({
      end: scene.start + scene.duration,
      sceneId: scene.id,
      start: scene.start,
    }));
  for (const sceneId of selected) {
    links.sceneIds.add(sceneId);
  }
  for (const clip of template.clips ?? []) {
    if (
      !globalLayerIds.has(clip.layerId) &&
      ctx.timingBelongsToSelectedScene(clip, clip.start, windows, selected)
    ) {
      links.clipLayerIds.add(clip.layerId);
    }
  }
  for (const phase of template.timeline?.phases ?? []) {
    const phaseLayerIds = ctx.getPhaseTrackLayerIds(
      template.timeline,
      phase.id,
    );
    if (
      ![...phaseLayerIds].some((layerId) => globalLayerIds.has(layerId)) &&
      ctx.timingBelongsToSelectedScene(phase, phase.start, windows, selected)
    ) {
      links.phaseIds.add(phase.id);
    }
  }
  for (const track of template.timeline?.tracks ?? []) {
    if (globalLayerIds.has(ctx.getTrackLayerId(track))) {
      continue;
    }
    if (selected.has(track.sceneId)) {
      links.trackIds.add(track.id);
    }
    for (const keyframe of track.keyframes ?? []) {
      if (
        ctx.timingBelongsToSelectedScene(
          keyframe,
          keyframe.time,
          windows,
          selected,
          track.sceneId,
        )
      ) {
        links.trackIds.add(track.id);
        links.keyframes.add(ctx.keyframeLinkKey(track.id, keyframe.id));
      }
    }
  }
}

function collectClipOwnershipLinks(
  ctx: ViewerAppContext,
  template,
  layerIds,
  links,
) {
  const selected = new Set(layerIds);
  const movablePhaseIds = ctx.getClipMovablePhaseIds(
    template.timeline ?? { phases: [], tracks: [] },
    template.clips ?? [],
    selected,
  );
  for (const layerId of selected) {
    links.clipLayerIds.add(layerId);
  }
  const clipsByLayer = new Map(
    (template.clips ?? []).map((clip) => [clip.layerId, clip]),
  );
  for (const track of template.timeline?.tracks ?? []) {
    const layerId = ctx.getTrackLayerId(track);
    if (!layerId || !selected.has(layerId)) {
      continue;
    }
    links.trackIds.add(track.id);
    const clip: any = clipsByLayer.get(layerId);
    for (const keyframe of track.keyframes ?? []) {
      if (
        !clip ||
        (ctx.isTimeInsideRange(
          Number(keyframe.time) || 0,
          clip.start,
          clip.start + clip.duration,
        ) &&
          ctx.keyframeCanMoveWithClip(
            template.timeline,
            track,
            keyframe,
            clip,
          ) &&
          ctx.keyframePhaseCanMoveWithClip(
            template.timeline,
            track,
            keyframe,
            movablePhaseIds,
          ))
      ) {
        links.keyframes.add(ctx.keyframeLinkKey(track.id, keyframe.id));
        const phaseId = keyframe.phaseId ?? track.phaseId;
        if (phaseId && movablePhaseIds.has(phaseId)) {
          links.phaseIds.add(phaseId);
        }
      }
    }
  }
}

function collectPhaseOwnershipLinks(
  ctx: ViewerAppContext,
  template,
  phaseIds,
  links,
) {
  const selected = new Set(phaseIds);
  for (const phaseId of selected) {
    links.phaseIds.add(phaseId);
  }
  for (const track of template.timeline?.tracks ?? []) {
    if (selected.has(track.phaseId)) {
      links.trackIds.add(track.id);
    }
    for (const keyframe of track.keyframes ?? []) {
      if (ctx.keyframeBelongsToSelectedPhase(keyframe, track, selected)) {
        links.trackIds.add(track.id);
        links.keyframes.add(ctx.keyframeLinkKey(track.id, keyframe.id));
      }
    }
  }
}

function collectTrackOwnershipLinks(
  ctx: ViewerAppContext,
  template,
  trackId,
  links,
) {
  const track = template.timeline?.tracks?.find((item) => item.id === trackId);
  if (!track) {
    return;
  }
  links.trackIds.add(track.id);
  const layerId = ctx.getTrackLayerId(track);
  if (layerId) {
    links.clipLayerIds.add(layerId);
  }
  if (track.phaseId) {
    links.phaseIds.add(track.phaseId);
  }
  if (track.sceneId) {
    links.sceneIds.add(track.sceneId);
  }
  for (const keyframe of track.keyframes ?? []) {
    links.keyframes.add(ctx.keyframeLinkKey(track.id, keyframe.id));
    if (keyframe.phaseId) {
      links.phaseIds.add(keyframe.phaseId);
    }
    if (keyframe.sceneId) {
      links.sceneIds.add(keyframe.sceneId);
    }
  }
}

function assignKeyframeOwnershipAtTime(
  ctx: ViewerAppContext,
  keyframe,
  track,
  time,
) {
  keyframe.phaseId = ctx.findPhaseIdAtTime(
    ctx.state.currentTemplate,
    time,
    ctx.getTrackLayerId(track),
  );
  keyframe.sceneId = ctx.findSceneIdAtTime(ctx.state.currentTemplate, time);
  if (track.phaseId && keyframe.phaseId === track.phaseId) {
    keyframe.phaseId = null;
  }
  if (track.sceneId && keyframe.sceneId === track.sceneId) {
    keyframe.sceneId = null;
  }
}

export function installModelOwnershipLinksOwner(ctx: ViewerAppContext): void {
  ctx.getKeyframeOwnershipSceneId = (...args: any[]) =>
    (getKeyframeOwnershipSceneId as any)(ctx, ...args);
  ctx.markOwnershipLink = (...args: any[]) =>
    (markOwnershipLink as any)(ctx, ...args);
  ctx.createEmptyOwnershipLinks = (...args: any[]) =>
    (createEmptyOwnershipLinks as any)(ctx, ...args);
  ctx.buildSelectedOwnershipLinks = (...args: any[]) =>
    (buildSelectedOwnershipLinks as any)(ctx, ...args);
  ctx.collectSceneOwnershipLinks = (...args: any[]) =>
    (collectSceneOwnershipLinks as any)(ctx, ...args);
  ctx.collectClipOwnershipLinks = (...args: any[]) =>
    (collectClipOwnershipLinks as any)(ctx, ...args);
  ctx.collectPhaseOwnershipLinks = (...args: any[]) =>
    (collectPhaseOwnershipLinks as any)(ctx, ...args);
  ctx.collectTrackOwnershipLinks = (...args: any[]) =>
    (collectTrackOwnershipLinks as any)(ctx, ...args);
  ctx.assignKeyframeOwnershipAtTime = (...args: any[]) =>
    (assignKeyframeOwnershipAtTime as any)(ctx, ...args);
}
