import type { EffectLayer } from "../../../sdk/types.js";
import type { CanvasPropertyResolution } from "./contract.js";
import type { ViewerAppContext } from "../app/context.js";

export function getLayerAuthorCanvasBox(
  ctx: ViewerAppContext,
  layerId: string,
  layer: EffectLayer,
  resolution: CanvasPropertyResolution = {},
) {
  const capabilities = ctx.getLayerEditorCapabilities(layer);
  if (capabilities.canvas === "none") {
    return null;
  }
  if (capabilities.canvas === "fullFrame") {
    return {
      height: ctx.refs.canvas.height,
      rotation: 0,
      width: ctx.refs.canvas.width,
      x: 0,
      y: 0,
    };
  }
  const scaleX = Math.max(
    0.05,
    ctx.getResolvedLayerProperty(layer, "scaleX", resolution),
  );
  const scaleY = Math.max(
    0.05,
    ctx.getResolvedLayerProperty(layer, "scaleY", resolution),
  );
  const rotation = ctx.getResolvedLayerProperty(layer, "rotation", resolution);
  const baseBox = ctx.getLayerBaseCanvasBox(layerId, layer, resolution);
  if (!baseBox) return null;
  const anchor = ctx.getResolvedLayerAnchor(layer, resolution);
  const pivot = {
    x: baseBox.x + baseBox.width * (0.5 + anchor.x),
    y: baseBox.y + baseBox.height * (0.5 + anchor.y),
  };
  return {
    height: baseBox.height * scaleY,
    rotation,
    width: baseBox.width * scaleX,
    x: pivot.x - (pivot.x - baseBox.x) * scaleX,
    y: pivot.y - (pivot.y - baseBox.y) * scaleY,
  };
}
