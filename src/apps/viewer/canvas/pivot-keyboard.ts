import type { ViewerAppContext } from "../app/context.js";
import { prepareCanvasGesture } from "./gesture.js";
import { calculateCanvasAnchorMove } from "./transform-math.js";

function rotateSelectedCanvasLayer(ctx: ViewerAppContext, delta) {
  if (ctx.refs.canvasSelectionBox.dataset.selectionKind === "multi") {
    return ctx.rotateCanvasSelectionBy?.(delta) ?? false;
  }
  const template = ctx.state.currentTemplate;
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  const layerId = ctx.refs.canvasSelectionBox.dataset.layerId;
  if (!layerId) return;
  const layer = effectiveTemplate?.layers.find((item) => item.id === layerId);
  if (
    !template ||
    !layer ||
    layer.locked ||
    !ctx.isLayerCanvasSelectable(layer) ||
    !ctx.canTransformLayerProperty(layer, "rotation")
  ) {
    return false;
  }
  const time = prepareCanvasGesture(ctx);
  const resolution = {
    time,
    timeline: ctx.getEffectiveTimeline(template),
  };
  const rotation = ctx.deps.clamp(
    ctx.getResolvedLayerProperty(layer, "rotation", resolution) + delta,
    -360,
    360,
  );
  ctx.beginEditorCommand(
    {
      payload: { layerId, properties: ["rotation"] },
      type: "updateLayerProperty",
    },
    {
      coalesceKey: `keyboard-rotate:${layerId}`,
    },
  );
  ctx.updateLayerPropertyAtTime(layerId, "rotation", time, rotation, {
    keyframe: true,
  });
  return true;
}

function moveSelectedCanvasAnchor(ctx: ViewerAppContext, delta) {
  const template = ctx.state.currentTemplate;
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  const layerId = ctx.refs.canvasSelectionBox.dataset.layerId;
  if (!layerId) return;
  const layer = effectiveTemplate?.layers.find((item) => item.id === layerId);
  if (
    !template ||
    !layer ||
    layer.locked ||
    !ctx.isLayerCanvasSelectable(layer) ||
    !ctx.canTransformLayerProperty(layer, "anchorX") ||
    !ctx.canTransformLayerProperty(layer, "anchorY")
  ) {
    return false;
  }
  const time = prepareCanvasGesture(ctx);
  const resolution = {
    time,
    timeline: ctx.getEffectiveTimeline(template),
  };
  const box = ctx.getLayerCanvasBox(layerId, layer, resolution);
  if (!box) {
    return false;
  }
  const original = {
    scaleX: Math.max(
      0.05,
      ctx.getResolvedLayerProperty(layer, "scaleX", resolution),
    ),
    scaleY: Math.max(
      0.05,
      ctx.getResolvedLayerProperty(layer, "scaleY", resolution),
    ),
    x: ctx.getResolvedLayerProperty(layer, "x", resolution),
    y: ctx.getResolvedLayerProperty(layer, "y", resolution),
  };
  const next = calculateCanvasAnchorMove({
    anchor: ctx.getResolvedLayerAnchor(layer, resolution),
    box,
    delta,
    original,
    rotation: Number(box.rotation) || 0,
  });
  ctx.beginEditorCommand(
    {
      payload: {
        layerId,
        properties: ["x", "y", "anchorX", "anchorY"],
      },
      type: "updateLayerProperty",
    },
    {
      coalesceKey: `keyboard-anchor:${layerId}`,
    },
  );
  ctx.updateLayerPropertiesAtTime(layerId, time, next, { keyframe: true });
  return true;
}

export function installCanvasPivotKeyboardOwner(ctx: ViewerAppContext): void {
  ctx.rotateSelectedCanvasLayer = rotateSelectedCanvasLayer.bind(
    undefined,
    ctx,
  );
  ctx.moveSelectedCanvasAnchor = moveSelectedCanvasAnchor.bind(undefined, ctx);
}
