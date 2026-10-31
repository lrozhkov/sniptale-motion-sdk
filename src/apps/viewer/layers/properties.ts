import { bindViewerAction } from "../app/bind-action.js";
import type { LayerOperationActions } from "./actions-contract.js";
import type { EditorTemplateSource } from "../templates/model.js";
import type { MotionPathTrack } from "../../../shared/timeline/motion-path.js";
import type { TimelineKeyframe } from "../../../sdk/types.js";
import type { TrackLayerSource } from "./model.js";
import type { ViewerAppContext } from "../app/context.js";
import { getLayerLeafIds, isLayerGroup } from "./hierarchy.js";

function toggleLayerVisibility(ctx: ViewerAppContext, layerId: string) {
  toggleLayerBooleanState(ctx, layerId, "visible");
}

function toggleLayerLock(ctx: ViewerAppContext, layerId: string) {
  toggleLayerBooleanState(ctx, layerId, "locked");
}

function toggleLayerBooleanState(
  ctx: ViewerAppContext,
  layerId: string,
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

export function getTrackLayerId(
  track: TrackLayerSource | null | undefined,
): string | null {
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
    return track.id.slice(0, track.id.indexOf("."));
  }
  return null;
}

function hasLayerPropertyKeyframeAtCurrentTime(
  ctx: ViewerAppContext,
  layerId: string,
  property: string,
) {
  const timeline = ctx.getEffectiveTimeline(ctx.state.currentTemplate);
  const track = timeline.tracks.find(
    (item) => item.id === `${layerId}.${property}`,
  );
  const time = ctx.snapTime(Number(ctx.refs.timeSlider.value) || 0);
  return Boolean(
    track?.keyframes.some(
      (keyframe) => Math.abs(keyframe.time - time) < 0.0001,
    ),
  );
}

function toggleLayerPropertyKeyframe(
  ctx: ViewerAppContext,
  layerId: string,
  property: string,
) {
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
      (keyframe) => Math.abs(keyframe.time - time) < 0.0001,
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
  layerId: string,
  track: MotionPathTrack | undefined,
  keyframe: TimelineKeyframe<unknown>,
  time: number,
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

function isLayerActiveAtTime(
  template: Pick<EditorTemplateSource, "clips"> | null | undefined,
  layerId: string,
  time: number,
) {
  if (!template) return false;
  const clips = (template.clips ?? []).filter(
    (clip) => clip.layerId === layerId,
  );
  if (clips.length === 0) {
    return true;
  }
  return clips.some(
    (clip) =>
      clip.enabled !== false &&
      time >= clip.start &&
      time <= clip.start + clip.duration,
  );
}

export function createLayerPropertyActions(
  getContext: () => ViewerAppContext,
): Pick<
  LayerOperationActions,
  | "toggleLayerVisibility"
  | "toggleLayerLock"
  | "hasLayerPropertyKeyframeAtCurrentTime"
  | "toggleLayerPropertyKeyframe"
  | "isLayerActiveAtTime"
> {
  return {
    toggleLayerVisibility: bindViewerAction(toggleLayerVisibility, getContext),
    toggleLayerLock: bindViewerAction(toggleLayerLock, getContext),
    hasLayerPropertyKeyframeAtCurrentTime: bindViewerAction(
      hasLayerPropertyKeyframeAtCurrentTime,
      getContext,
    ),
    toggleLayerPropertyKeyframe: bindViewerAction(
      toggleLayerPropertyKeyframe,
      getContext,
    ),
    isLayerActiveAtTime,
  };
}
