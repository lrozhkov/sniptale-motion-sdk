import type { EffectLayer } from "../../../sdk/types.js";
import type { EditorTemplate } from "../templates/model.js";
import type { CanvasPoint } from "./geometry-contract.js";
import type { MotionPathPointRef } from "./motion-path-reference.js";

export type CanvasSelectionTarget = {
  kind: "layer" | "selection";
  primaryLayerId: string | null;
  layerIds: string[];
  rootLayerIds: string[];
  related: boolean;
};
export type EditablePathPointHit = {
  layerId: string;
  pointIndex: number;
  distance: number;
};
export type MotionPathPointHit = MotionPathPointRef & { distance: number };
export interface CanvasPathActions {
  hideMotionPathOverlay(): void;
  renderMotionPathOverlay(template: EditorTemplate, layer: EffectLayer): void;
  renderSelectedMotionPathOverlay(
    template: EditorTemplate,
    target: CanvasSelectionTarget,
  ): boolean;
  renderEditablePathOverlay(layer: EffectLayer): void;
  getEditablePathPoints(layer: EffectLayer): CanvasPoint[];
  getEditablePathStagePoint(
    layer: EffectLayer,
    point: CanvasPoint,
  ): CanvasPoint | null;
  beginMotionPathPointDrag(
    event: PointerEvent,
    layerId: string,
    xKeyframeId: string,
    yKeyframeId: string,
  ): void;
  handleMotionPathPointKeydown(
    event: KeyboardEvent,
    layerId: string,
    xKeyframeId: string,
    yKeyframeId: string,
  ): void;
  beginMotionPathTangentDrag(
    event: PointerEvent,
    layerId: string,
    xKeyframeId: string,
    yKeyframeId: string,
    side: "in" | "out",
  ): void;
  handleMotionPathTangentKeydown(
    event: KeyboardEvent,
    layerId: string,
    xKeyframeId: string,
    yKeyframeId: string,
    side: "in" | "out",
  ): void;
  beginEditablePathPointDrag(
    event: PointerEvent,
    layerId: string,
    pointIndex: number,
  ): void;
  beginMotionPathPointHitDrag(event: PointerEvent): void;
  beginOverlappingTransformHandleDrag(event: PointerEvent): boolean;
  findEditablePathPointNearEvent(
    event: MouseEvent,
  ): EditablePathPointHit | null;
  findMotionPathPointNearEvent(event: MouseEvent): MotionPathPointHit | null;
}
