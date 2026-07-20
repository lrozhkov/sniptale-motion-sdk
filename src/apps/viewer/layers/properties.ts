import type { ViewerAppContext } from "../app/context.js";
import { getLayerLeafIds, isLayerGroup } from "./hierarchy.js";

function toggleLayerVisibility(ctx: ViewerAppContext, layerId) {
  toggleLayerBooleanState(ctx, layerId, "visible");
}

function toggleLayerLock(ctx: ViewerAppContext, layerId) {
  toggleLayerBooleanState(ctx, layerId, "locked");
}

function toggleLayerBooleanState(
  ctx: ViewerAppContext,
  layerId,
  property: "locked" | "visible",
) {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  if (!template) {
    return;
  }
  const hierarchy = ctx.getLayerHierarchy(template);
  const target = hierarchy.byId.get(layerId);
  const layerIds = isLayerGroup(target)
    ? getLayerLeafIds(hierarchy, [layerId])
    : [layerId];
  const layers = ctx.deps.deepClone(template.layers);
  const selected = layers.filter((layer) => layerIds.includes(layer.id));
  if (selected.length === 0) {
    return;
  }
  const next =
    property === "visible"
      ? selected.some((layer) => layer.visible === false)
      : !selected.every((layer) => layer.locked === true);
  ctx.beginEditorCommand({
    payload: { layerIds, property, value: next },
    type: "updateLayerProperty",
  });
  for (const layer of selected) {
    layer[property] = next;
  }
  ctx.setEditorOverride({ layers });
  ctx.renderTimelineEditor(ctx.state.currentTemplate);
  void ctx.renderCurrentFrame();
}

function getTrackLayerId(ctx: ViewerAppContext, track) {
  if (typeof track?.layerId === "string") {
    return track.layerId;
  }
  if (track?.target === "scene") {
    return null;
  }
  if (typeof track?.target === "string" && track.target !== "scene") {
    return track.target;
  }
  if (typeof track?.id === "string" && track.id.includes(".")) {
    return track.id.split(".")[0];
  }
  return null;
}

function hasLayerPropertyKeyframeAtCurrentTime(
  ctx: ViewerAppContext,
  layerId,
  property,
) {
  const timeline = ctx.getEffectiveTimeline(ctx.state.currentTemplate);
  const track = timeline.tracks.find(
    (item) => item.id === `${layerId}.${property}`,
  );
  const time = ctx.snapTime(Number(ctx.refs.timeSlider.value) || 0);
  return Boolean(
    track?.keyframes.some(
      (keyframe) => Math.abs(Number(keyframe.time) - time) < 0.0001,
    ),
  );
}

function toggleLayerPropertyKeyframe(ctx: ViewerAppContext, layerId, property) {
  const template = ctx.state.currentTemplate;
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  const layer = effectiveTemplate?.layers.find((item) => item.id === layerId);
  if (
    !template ||
    !layer ||
    layer.locked ||
    !ctx.canKeyframeLayerProperty(layer, property)
  ) {
    return;
  }
  const timeline = ctx.getEffectiveTimeline(template);
  const trackId = `${layerId}.${property}`;
  const time = ctx.snapTime(Number(ctx.refs.timeSlider.value) || 0);
  const track = timeline.tracks.find((item) => item.id === trackId);
  const existingIndex =
    track?.keyframes.findIndex(
      (keyframe) => Math.abs(Number(keyframe.time) - time) < 0.0001,
    ) ?? -1;
  if (track && existingIndex >= 0) {
    ctx.commitHistory(`toggle-keyframe:${trackId}`);
    track.keyframes.splice(existingIndex, 1);
    timeline.tracks = timeline.tracks.filter(
      (item) => item.keyframes.length > 0,
    );
    ctx.selectLayer(layerId);
  } else {
    const value = ctx.getResolvedLayerProperty(layer, property);
    ctx.commitHistory(`toggle-keyframe:${trackId}`);
    const keyframe = ctx.upsertTrackKeyframe(
      timeline,
      layerId,
      property,
      value,
      time,
    );
    if (!keyframe) {
      return;
    }
    revealLayerPropertyTrack(
      ctx,
      layerId,
      track ?? timeline.tracks.find((item) => item.id === trackId),
      keyframe,
      time,
    );
    ctx.selectLayer(layerId);
  }
  ctx.state.timelineOverrides.set(
    template.id,
    ctx.deps.normalizeTimeline(timeline, ctx.getEffectiveDuration(template)),
  );
  ctx.renderTimelineEditor(template);
  void ctx.renderCurrentFrame();
}

function revealLayerPropertyTrack(
  ctx: ViewerAppContext,
  layerId,
  track,
  keyframe,
  time,
) {
  if (!track) {
    return;
  }
  const sceneId =
    keyframe.sceneId ??
    track.sceneId ??
    ctx.findSceneIdAtTime(ctx.state.currentTemplate, time);
  if (!sceneId) {
    return;
  }
  ctx.state.expandedSceneIds.add(sceneId);
  ctx.setTimelineRowExpanded("scene", sceneId, true);
  ctx.setTimelineRowExpanded("layer", `${sceneId}:${layerId}`, true);
  const phaseId = keyframe.phaseId ?? track.phaseId;
  if (phaseId) {
    ctx.setTimelineRowExpanded(
      "phase",
      `${sceneId}:${layerId}:${phaseId}`,
      true,
    );
  }
}

function isLayerActiveAtTime(ctx: ViewerAppContext, template, layerId, time) {
  const clips = (template.clips ?? []).filter(
    (clip) => clip.layerId === layerId,
  );
  if (clips.length === 0) {
    return true;
  }
  return clips.some(
    (clip) =>
      clip.enabled !== false &&
      time >= Number(clip.start || 0) &&
      time <= Number(clip.start || 0) + Number(clip.duration || 0),
  );
}

export function installLayersPropertiesOwner(ctx: ViewerAppContext): void {
  ctx.toggleLayerVisibility = (...args: any[]) =>
    (toggleLayerVisibility as any)(ctx, ...args);
  ctx.toggleLayerLock = (...args: any[]) =>
    (toggleLayerLock as any)(ctx, ...args);
  ctx.getTrackLayerId = (...args: any[]) =>
    (getTrackLayerId as any)(ctx, ...args);
  ctx.hasLayerPropertyKeyframeAtCurrentTime = (...args: any[]) =>
    (hasLayerPropertyKeyframeAtCurrentTime as any)(ctx, ...args);
  ctx.toggleLayerPropertyKeyframe = (...args: any[]) =>
    (toggleLayerPropertyKeyframe as any)(ctx, ...args);
  ctx.isLayerActiveAtTime = (...args: any[]) =>
    (isLayerActiveAtTime as any)(ctx, ...args);
}
