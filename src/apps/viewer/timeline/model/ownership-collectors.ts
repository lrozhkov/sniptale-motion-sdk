import type { EditorTemplate } from "../../templates/model.js";

import type { OwnershipLinks } from "./ownership-model.js";
import type { ViewerAppContext } from "../../app/context.js";

export function collectSceneOwnershipLinks(
  ctx: ViewerAppContext,
  template: EditorTemplate,
  sceneIds: string[],
  links: OwnershipLinks,
): void {
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
    const trackLayerId = ctx.getTrackLayerId(track);
    if (trackLayerId !== null && globalLayerIds.has(trackLayerId)) {
      continue;
    }
    if (track.sceneId && selected.has(track.sceneId)) {
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

export function collectClipOwnershipLinks(
  ctx: ViewerAppContext,
  template: EditorTemplate,
  layerIds: string[],
  links: OwnershipLinks,
): void {
  const selected = new Set(layerIds);
  const movablePhaseIds = ctx.getClipMovablePhaseIds(
    template.timeline ?? {
      duration: template.duration,
      phases: [],
      tracks: [],
    },
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
    const clip = clipsByLayer.get(layerId);
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

export function collectPhaseOwnershipLinks(
  ctx: ViewerAppContext,
  template: EditorTemplate,
  phaseIds: string[],
  links: OwnershipLinks,
): void {
  const selected = new Set(phaseIds);
  for (const phaseId of selected) {
    links.phaseIds.add(phaseId);
  }
  for (const track of template.timeline?.tracks ?? []) {
    if (track.phaseId && selected.has(track.phaseId)) {
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

export function collectTrackOwnershipLinks(
  ctx: ViewerAppContext,
  template: EditorTemplate,
  trackId: string,
  links: OwnershipLinks,
): void {
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

export function collectKeyframeParentLinks(
  ctx: ViewerAppContext,
  template: EditorTemplate,
  trackId: string,
  keyframeId: string,
  links: OwnershipLinks,
): void {
  const track = template.timeline?.tracks?.find((item) => item.id === trackId);
  const keyframe = track?.keyframes?.find((item) => item.id === keyframeId);
  if (!track || !keyframe) {
    return;
  }
  links.trackIds.add(track.id);
  links.keyframes.add(ctx.keyframeLinkKey(track.id, keyframe.id));
  const layerId = ctx.getTrackLayerId(track);
  if (layerId) {
    links.clipLayerIds.add(layerId);
  }
  const phaseId = keyframe.phaseId ?? track.phaseId;
  if (phaseId) {
    links.phaseIds.add(phaseId);
  }
  const sceneId = keyframe.sceneId ?? track.sceneId;
  if (sceneId) {
    links.sceneIds.add(sceneId);
  }
}
