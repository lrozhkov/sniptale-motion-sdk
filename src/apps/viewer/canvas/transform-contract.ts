import type { CanvasPoint } from "./geometry-contract.js";
export interface CanvasTransformActions {
  beginCanvasLayerDrag(
    event: PointerEvent,
    explicitLayerId?: string | null,
  ): void;
  beginCanvasScaleDrag(event: PointerEvent, handle: string): void;
  resizeSelectedCanvasLayer(
    handle: string,
    delta: CanvasPoint,
    lockAspect?: boolean,
  ): boolean;
  beginCanvasRotationDrag(event: PointerEvent): void;
  beginCanvasAnchorDrag(event: PointerEvent): void;
  rotateSelectedCanvasLayer(delta: number): boolean;
  moveSelectedCanvasAnchor(delta: CanvasPoint): boolean;
  handleCanvasTransformHandleKeydown(event: KeyboardEvent): void;
  beginCanvasSelectionDrag(event: PointerEvent): boolean;
  beginCanvasSelectionScaleDrag(event: PointerEvent, handle: string): boolean;
  beginCanvasSelectionRotationDrag(event: PointerEvent): boolean;
  moveCanvasSelectionBy(dx: number, dy: number): boolean;
  rotateCanvasSelectionBy(delta: number): boolean;
  scaleCanvasSelectionBy(requestedFactor: number): boolean;
  setCanvasSelectionFrameProperty(
    property: "height" | "left" | "top" | "width",
    requestedValue: number,
  ): boolean;
}
