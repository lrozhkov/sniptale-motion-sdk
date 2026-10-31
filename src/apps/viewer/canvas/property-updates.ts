import { bindViewerAction } from "../app/bind-action.js";
import type { EffectLayer } from "../../../sdk/types.js";
import type { EditorTimeline } from "../editor/model-types.js";
import type {
  CanvasPropertyActions,
  CanvasUpdateOptions,
  CanvasPropertyResolution,
} from "./contract.js";
import type { ViewerAppContext } from "../app/context.js";
import { prepareCanvasGesture } from "./gesture.js";
import {
  getDefaultLayerProperty,
  resolveNumericTrack as resolveNumericTrackOwner,
} from "./numeric-track.js";
import { updateLayerPropertiesAtTime as updateLayerPropertiesAtTimeOwner } from "./property-batch.js";
import { updateLayerPropertyBatchAtTime as updateLayerPropertyBatchAtTimeOwner } from "./property-batch.js";

function updatePathPoint(
  ctx: ViewerAppContext,
  layerId: string,
  pointIndex: number,
  point: { x: number; y: number },
  options: CanvasUpdateOptions = {},
) {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  if (!template) {
    return;
  }
  const layers = ctx.deps.deepClone(template.layers);
  const layer = layers.find((item) => item.id === layerId);
  if (!layer || layer.type !== "path") {
    return;
  }
  const points = ctx.getEditablePathPoints(layer);
  if (!points[pointIndex]) {
    return;
  }
  points[pointIndex] = point;
  layer.pathPoints = points;
  ctx.setEditorOverride({ layers });
  if (options.timeline !== false) {
    ctx.renderTimelineEditor(ctx.state.currentTemplate);
  }
  if (options.selection !== false) {
    ctx.updateCanvasSelectionBox({
      motionPath: options.motionPath !== false,
    });
  }
  if (options.render !== false) {
    void ctx.renderCurrentFrame();
  }
}

function updateLayerPosition(
  ctx: ViewerAppContext,
  layerId: string,
  x: number,
  y: number,
  options: CanvasUpdateOptions = {},
) {
  ctx.updateLayerPropertiesAtTime(
    layerId,
    ctx.snapTime(Number(ctx.refs.timeSlider.value) || 0),
    { x, y },
    options,
  );
}

function updateLayerPositionAtTime(
  ctx: ViewerAppContext,
  layerId: string,
  time: number,
  x: number,
  y: number,
  options: CanvasUpdateOptions = {},
) {
  ctx.updateLayerPropertiesAtTime(layerId, time, { x, y }, options);
}

function updateLayerDefinitionProperty(
  ctx: ViewerAppContext,
  layerId: string,
  property: string,
  value: unknown,
) {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  if (!template) {
    return;
  }
  const layers = ctx.deps.deepClone(template.layers);
  const layer = layers.find((item) => item.id === layerId);
  if (!layer) {
    return;
  }
  layer[property] = value;
  ctx.setEditorOverride({ layers });
  ctx.renderTimelineEditor(ctx.state.currentTemplate);
  void ctx.renderCurrentFrame();
}

function updateLayerClipProperty(
  ctx: ViewerAppContext,
  layerId: string,
  property: "start" | "duration" | "offset",
  value: number | string,
) {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  if (!template) {
    return;
  }
  const clips = ctx.deps.deepClone(template.clips);
  const clip = clips.find((item) => item.layerId === layerId);
  if (!clip || clip.locked) {
    return;
  }
  const totalDuration = ctx.getEffectiveDuration(ctx.state.currentTemplate);
  if (property === "start") {
    const nextStart = ctx.snapTime(
      ctx.deps.clamp(
        Number(value) || 0,
        0,
        Math.max(0, totalDuration - clip.duration),
      ),
    );
    const plan = ctx.createClipMovePlan(template, [layerId], totalDuration);
    ctx.applyClipMovePlan(
      ctx.state.currentTemplate,
      plan,
      ctx.deps.clamp(nextStart - clip.start, plan.minDelta, plan.maxDelta),
    );
    ctx.selectClipBlock(layerId);
    return;
  } else if (property === "duration") {
    clip.duration = ctx.deps.clamp(
      Number(value) || 0.05,
      0.05,
      Math.max(0.05, totalDuration - clip.start),
    );
  } else if (property === "offset") {
    clip.offset = ctx.deps.clamp(Number(value) || 0, 0, totalDuration);
  }
  ctx.setEditorOverride({ clips });
  ctx.selectClipBlock(layerId);
  ctx.renderTimelineEditor(ctx.state.currentTemplate);
  void ctx.renderCurrentFrame();
}

function updateLayerProperty(
  ctx: ViewerAppContext,
  layerId: string,
  property: string,
  value: unknown,
  options: CanvasUpdateOptions = {},
) {
  ctx.updateLayerPropertyAtTime(
    layerId,
    property,
    ctx.snapTime(Number(ctx.refs.timeSlider.value) || 0),
    value,
    options,
  );
}

function updateLayerPropertyAtTime(
  ctx: ViewerAppContext,
  layerId: string,
  property: string,
  time: number,
  value: unknown,
  options: CanvasUpdateOptions = {},
) {
  ctx.updateLayerPropertiesAtTime(
    layerId,
    time,
    { [property]: value },
    options,
  );
}

function nudgeSelectedLayer(ctx: ViewerAppContext, dx: number, dy: number) {
  const selectionTarget = ctx.getCanvasSelectionTarget?.(
    ctx.getEffectiveTemplate(ctx.state.currentTemplate),
  );
  if (selectionTarget?.kind === "selection") {
    return ctx.moveCanvasSelectionBy(dx, dy);
  }
  const template = ctx.state.currentTemplate;
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  const layerId =
    ctx.state.selectedItem?.type === "layer"
      ? ctx.state.selectedItem.layerId
      : null;
  const layer = effectiveTemplate?.layers.find((item) => item.id === layerId);
  if (
    !template ||
    !layer ||
    layer.locked ||
    !ctx.isLayerCanvasSelectable(layer) ||
    !ctx.canTransformLayerProperty(layer, "x") ||
    !ctx.canTransformLayerProperty(layer, "y")
  ) {
    return;
  }
  const time = prepareCanvasGesture(ctx);
  const resolution = {
    time,
    timeline: ctx.getEffectiveTimeline(template),
  };
  ctx.commitHistory(`nudge-layer:${layerId}`, {
    coalesceKey: `nudge-layer:${layerId}`,
  });
  ctx.updateLayerPositionAtTime(
    layer.id,
    time,
    ctx.getResolvedLayerProperty(layer, "x", resolution) + dx,
    ctx.getResolvedLayerProperty(layer, "y", resolution) + dy,
  );
}

function upsertTrackKeyframe(
  ctx: ViewerAppContext,
  timeline: EditorTimeline,
  layerId: string,
  property: string,
  value: unknown,
  atTime = ctx.snapTime(Number(ctx.refs.timeSlider.value) || 0),
) {
  const trackId = `${layerId}.${property}`;
  const time = Number(atTime) || 0;
  const phaseId = ctx.findPhaseIdAtTime(
    ctx.state.currentTemplate,
    time,
    layerId,
  );
  const sceneId = ctx.findSceneIdAtTime(ctx.state.currentTemplate, time);
  let track = timeline.tracks.find((item) => item.id === trackId);
  if (!track) {
    track = {
      id: trackId,
      keyframes: [],
      layerId,
      phaseId,
      property,
      sceneId,
      target: layerId,
    };
    timeline.tracks.push(track);
  }
  let keyframe = track.keyframes.find(
    (item) => Math.abs(item.time - time) < 0.0001,
  );
  if (!keyframe) {
    keyframe = {
      easing: "linear",
      handles: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
      id: `${trackId}-${time.toFixed(3).replace(".", "-")}`,
      phaseId: track.phaseId === phaseId ? null : phaseId,
      sceneId: track.sceneId === sceneId ? null : sceneId,
      time,
      value,
    };
    track.keyframes.push(keyframe);
  }
  keyframe.value = value;
  track.keyframes.sort((a, b) => a.time - b.time);
  return keyframe;
}

function getResolvedLayerProperty(
  ctx: ViewerAppContext,
  layer: EffectLayer,
  property: string,
  resolution: CanvasPropertyResolution = {},
) {
  const template = ctx.state.currentTemplate;
  const timeline = resolution.timeline ?? ctx.getEffectiveTimeline(template);
  const trackId = `${layer.id}.${property}`;
  const track = timeline.tracks.find((item) => item.id === trackId);
  const fallback = ctx.getDefaultLayerProperty(layer, property);
  return ctx.resolveNumericTrack(
    track,
    Number(resolution.time ?? ctx.refs.timeSlider.value) || 0,
    fallback,
    timeline,
  );
}

export function createCanvasPropertyActions(
  getContext: () => ViewerAppContext,
): CanvasPropertyActions {
  return {
    updatePathPoint: bindViewerAction(updatePathPoint, getContext),
    updateLayerPosition: bindViewerAction(updateLayerPosition, getContext),
    updateLayerPositionAtTime: bindViewerAction(
      updateLayerPositionAtTime,
      getContext,
    ),
    updateLayerDefinitionProperty: bindViewerAction(
      updateLayerDefinitionProperty,
      getContext,
    ),
    updateLayerClipProperty: bindViewerAction(
      updateLayerClipProperty,
      getContext,
    ),
    updateLayerProperty: bindViewerAction(updateLayerProperty, getContext),
    updateLayerPropertyAtTime: bindViewerAction(
      updateLayerPropertyAtTime,
      getContext,
    ),
    upsertTrackKeyframe: bindViewerAction(upsertTrackKeyframe, getContext),
    getResolvedLayerProperty: bindViewerAction(
      getResolvedLayerProperty,
      getContext,
    ),
    nudgeSelectedLayer: bindViewerAction(nudgeSelectedLayer, getContext),
    updateLayerPropertiesAtTime: bindViewerAction(
      updateLayerPropertiesAtTimeOwner,
      getContext,
    ),
    updateLayerPropertyBatchAtTime: bindViewerAction(
      updateLayerPropertyBatchAtTimeOwner,
      getContext,
    ),
    getDefaultLayerProperty,
    resolveNumericTrack: bindViewerAction(resolveNumericTrackOwner, getContext),
  };
}
