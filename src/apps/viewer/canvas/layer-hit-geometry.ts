import type { ViewerAppContext } from "../app/context.js";
import { resolveLayerCanvasResizeProperty } from "../layers/editor-capabilities.js";
import { getLayerAuthorCanvasBox } from "./layer-author-geometry.js";
import { fitOrientedBoxToPrimitiveBounds } from "./primitive-geometry.js";

export function getLayerCanvasHitBox(
  ctx: ViewerAppContext,
  layerId,
  layer,
  resolution: any = {},
) {
  const transformPreview = ctx.state.canvasTransformPreview;
  if (
    transformPreview?.boxes?.[layerId] &&
    transformPreview.templateId === ctx.state.currentTemplate?.id
  ) {
    return { ...transformPreview.boxes[layerId] };
  }
  if (
    transformPreview?.layerId === layerId &&
    transformPreview.templateId === ctx.state.currentTemplate?.id
  ) {
    return { ...transformPreview.box };
  }
  const primitiveBox = ctx.getLayerPrimitiveCanvasBox(layerId, layer);
  if (!primitiveBox) {
    return ctx.getLayerCanvasBox(layerId, layer, resolution);
  }
  const authorBox = getLayerAuthorCanvasBox(ctx, layerId, layer, resolution);
  if (!authorBox || !ctx.layerHasAuthorGeometryHints(layerId, layer)) {
    return primitiveBox;
  }
  const rotation = ctx.getResolvedLayerProperty(layer, "rotation", resolution);
  return fitOrientedBoxToPrimitiveBounds({
    anchor: ctx.getResolvedLayerAnchor(layer, resolution),
    primitiveBox,
    referenceBox: authorBox,
    rotation,
  });
}

export function usesIntrinsicCanvasGeometry(capabilities): boolean {
  return (
    resolveLayerCanvasResizeProperty(capabilities, "x") === "width" ||
    resolveLayerCanvasResizeProperty(capabilities, "y") === "height"
  );
}

export function installCanvasLayerHitGeometryOwner(
  ctx: ViewerAppContext,
): void {
  ctx.getLayerCanvasHitBox = (...args: any[]) =>
    (getLayerCanvasHitBox as any)(ctx, ...args);
}
