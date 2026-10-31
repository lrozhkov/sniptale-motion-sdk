import type { EffectLayer } from "../../../sdk/types.js";
import type { CanvasBox } from "./primitive-geometry.js";
import type { CanvasPropertyResolution } from "./contract.js";

export type CanvasPoint = { x: number; y: number };
export type CanvasRect = Omit<CanvasBox, "rotation">;
export type CanvasMotionPathViewport = {
  canvasRect: DOMRect;
  stageRect: DOMRect;
  scaleX: number;
  scaleY: number;
};
export interface CanvasGeometryActions {
  getLayerCanvasBox(
    layerId: string,
    layer: EffectLayer,
    resolution?: CanvasPropertyResolution,
  ): CanvasBox | null;
  getLayerCanvasHitBox(
    layerId: string,
    layer: EffectLayer,
    resolution?: CanvasPropertyResolution,
  ): CanvasBox | null;
  getLayerAuthorCanvasBox(
    layerId: string,
    layer: EffectLayer,
    resolution?: CanvasPropertyResolution,
  ): CanvasBox | null;
  getLayerBaseCanvasBox(
    layerId: string,
    layer: EffectLayer,
    resolution?: CanvasPropertyResolution,
  ): CanvasRect | null;
  getLayerCanvasPivot(box: CanvasRect, layer: EffectLayer): CanvasPoint;
  getResolvedLayerAnchor(
    layer: EffectLayer,
    resolution?: CanvasPropertyResolution,
  ): CanvasPoint;
  getLayerPrimitiveCanvasBox(
    layerId: string,
    layer?: EffectLayer | null,
  ): CanvasBox | null;
  layerHasAuthorGeometryHints(
    layerId: string,
    layer?: EffectLayer | null,
  ): boolean;
  getLayerStaticCanvasBox(
    layerId: string,
    x: number,
    y: number,
    layer?: EffectLayer | null,
  ): CanvasRect;
}
