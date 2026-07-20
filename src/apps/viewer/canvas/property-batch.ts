import type { ViewerAppContext } from "../app/context.js";
import {
  getTimelineMotionPath,
  syncMotionPathPositionKeyframes,
} from "./motion-path-keyframe-policy.js";

export function updateLayerPropertiesAtTime(
  ctx: ViewerAppContext,
  layerId,
  time,
  properties,
  options: any = {},
) {
  updateLayerPropertyBatchAtTime(ctx, time, { [layerId]: properties }, options);
}

export function updateLayerPropertyBatchAtTime(
  ctx: ViewerAppContext,
  time,
  updates,
  options: any = {},
) {
  const template = ctx.state.currentTemplate;
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  if (!template || !effectiveTemplate) {
    return;
  }
  const layers = ctx.deps.deepClone(effectiveTemplate.layers);
  const timeline = ctx.getEffectiveTimeline(template);
  const updatesByLayerId = new Map(Object.entries(updates ?? {}));
  const changedLayerIds: string[] = [];
  let layersChanged = false;
  let timelineChanged = false;
  for (const layer of layers) {
    const properties = updatesByLayerId.get(layer.id);
    if (!properties || typeof properties !== "object") {
      continue;
    }
    changedLayerIds.push(layer.id);
    const handledSpatialProperties = updateSpatialPositionAtTime(
      ctx,
      timeline,
      layer,
      time,
      properties,
      options,
    );
    timelineChanged = handledSpatialProperties.size > 0 || timelineChanged;
    for (const [property, value] of Object.entries(properties)) {
      if (handledSpatialProperties.has(property)) {
        continue;
      }
      const track = timeline.tracks.find(
        (item) => item.id === `${layer.id}.${property}`,
      );
      if (track && options.keyframe !== false) {
        timelineChanged =
          Boolean(
            ctx.upsertTrackKeyframe(timeline, layer.id, property, value, time),
          ) || timelineChanged;
      } else {
        layer[property] = value;
        layersChanged = true;
      }
    }
  }
  if (changedLayerIds.length === 0) {
    return;
  }
  if (layersChanged) {
    ctx.setEditorOverride({ layers });
  }
  if (timelineChanged) {
    ctx.state.timelineOverrides.set(
      template.id,
      ctx.deps.normalizeTimeline(timeline, ctx.getEffectiveDuration(template)),
    );
  }
  if (options.inspector !== false) {
    if (changedLayerIds.length === 1) {
      const layerId = changedLayerIds[0];
      ctx.syncInspectorLayerPropertyState?.(
        layerId,
        updatesByLayerId.get(layerId),
      );
    } else {
      ctx.renderInspector?.();
    }
  }
  if (options.timeline !== false) {
    if (ctx.renderTimelineModel) {
      ctx.renderTimelineModel(template);
    } else {
      ctx.renderTimelineEditor(template);
    }
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

function updateSpatialPositionAtTime(
  ctx: ViewerAppContext,
  timeline,
  layer,
  time,
  properties,
  options,
): Set<string> {
  const path = getTimelineMotionPath(timeline, layer.id);
  const changesPosition =
    Object.prototype.hasOwnProperty.call(properties, "x") ||
    Object.prototype.hasOwnProperty.call(properties, "y");
  if (!path || !changesPosition || options.keyframe === false) {
    return new Set();
  }
  const xTrack = timeline.tracks.find((track) => track.id === `${layer.id}.x`);
  const yTrack = timeline.tracks.find((track) => track.id === `${layer.id}.y`);
  const x =
    properties.x ??
    ctx.resolveNumericTrack(
      xTrack,
      time,
      ctx.getDefaultLayerProperty(layer, "x"),
      timeline,
    );
  const y =
    properties.y ??
    ctx.resolveNumericTrack(
      yTrack,
      time,
      ctx.getDefaultLayerProperty(layer, "y"),
      timeline,
    );
  const xKeyframe = ctx.upsertTrackKeyframe(timeline, layer.id, "x", x, time);
  const yKeyframe = ctx.upsertTrackKeyframe(timeline, layer.id, "y", y, time);
  syncMotionPathPositionKeyframes(timeline, path, xKeyframe, yKeyframe);
  return new Set(["x", "y"]);
}
