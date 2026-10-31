import type { ViewerAppContext } from "./app/context.js";
import { createCanvasMotionPathModel } from "./canvas/motion-path-model.js";
import { getCanvasMotionPathStagePoint } from "./canvas/motion-path-overlay.js";

export function getLayerGeometryForTest(ctx: ViewerAppContext, layerId) {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  const layer = template?.layers.find((item) => item.id === layerId);
  if (!layer) {
    return null;
  }
  const box = ctx.getLayerCanvasBox(layer.id, layer);
  return ctx.deps.deepClone({
    active: ctx.isLayerActiveAtTime(
      template,
      layer.id,
      Number(ctx.refs.timeSlider.value) || 0,
    ),
    baseBox: ctx.getLayerBaseCanvasBox(layer.id, layer),
    box,
    capabilities: ctx.getLayerEditorCapabilities(layer),
    layerId: layer.id,
    pivot: box ? ctx.getLayerCanvasPivot(box, layer) : null,
  });
}

export function getSelectedLayerGeometryForTest(ctx: ViewerAppContext) {
  const layerId =
    ctx.state.selectedItem?.type === "layer"
      ? ctx.state.selectedItem.layerId
      : ctx.refs.canvasSelectionBox.dataset.layerId;
  return layerId ? getLayerGeometryForTest(ctx, layerId) : null;
}

export function getLayerPathPointsForTest(ctx: ViewerAppContext, layerId) {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  const layer = template?.layers.find((item) => item.id === layerId);
  if (!template || !layer) {
    return null;
  }
  const canvasRect = ctx.refs.canvas.getBoundingClientRect();
  const stage = ctx.refs.canvas.parentElement;
  if (!stage) return null;
  const stageRect = stage.getBoundingClientRect();
  const pageOffset = {
    x: stageRect.left,
    y: stageRect.top,
  };
  if (layer.type === "path") {
    return ctx.deps.deepClone({
      editable: ctx
        .getEditablePathPoints(layer)
        .map((point) =>
          withPagePoint(
            ctx.getEditablePathStagePoint(layer, point),
            pageOffset,
          ),
        ),
      motion: [],
    });
  }
  const model = createCanvasMotionPathModel(template.timeline, layer.id);
  const motion = model.ok
    ? model.points.map((point) =>
        withPagePoint(
          {
            ...getCanvasMotionPathStagePoint(ctx, layer, point),
            time: point.time,
          },
          pageOffset,
        ),
      )
    : [];
  return ctx.deps.deepClone({
    editable: [],
    motion,
    viewport: {
      canvasHeight: ctx.refs.canvas.height,
      canvasWidth: ctx.refs.canvas.width,
      stageHeight: stageRect.height,
      stageWidth: stageRect.width,
      scaleX: canvasRect.width / ctx.refs.canvas.width,
      scaleY: canvasRect.height / ctx.refs.canvas.height,
    },
  });
}

function withPagePoint(point, pageOffset) {
  return {
    ...point,
    pageX: pageOffset.x + point.x,
    pageY: pageOffset.y + point.y,
  };
}
