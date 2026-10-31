import type { EffectLayer } from "../../../sdk/types.js";
import type { EditorTemplate } from "../templates/model.js";
import type { LayerHierarchySource } from "../layers/hierarchy-contract.js";
import type { CanvasPoint } from "./geometry-contract.js";
import type { CanvasSelectionTarget } from "./path-contract.js";

export type CanvasLayerHit = { layer: EffectLayer; point: CanvasPoint };
export interface CanvasSelectionActions {
  getCanvasSelectionLayerId(template?: EditorTemplate | null): string | null;
  getCanvasSelectionTarget(
    template?: EditorTemplate | null,
  ): CanvasSelectionTarget | null;
  getCanvasPointFromEvent(
    event: Pick<MouseEvent, "clientX" | "clientY">,
  ): CanvasPoint;
  beginCanvasHitTestPointerDown(event: PointerEvent): void;
  handleCanvasDoubleClick(event: MouseEvent): void;
  findTopCanvasLayerAtEvent(event: MouseEvent): CanvasLayerHit | null;
  isCanvasPointInsideLayer(point: CanvasPoint, layer: EffectLayer): boolean;
  beginCanvasSelectionPointerDown(event: PointerEvent): void;
  isCanvasTransformHandleEvent(event: Pick<Event, "target">): boolean;
  beginCanvasMarqueeSelection(event: PointerEvent): boolean;
  resolveCanvasHitSelectionLayerId(
    leafLayerId: string,
    template?: LayerHierarchySource | null,
  ): string | null;
  getCanvasSelectionLevelLayerIds(
    template?: LayerHierarchySource | null,
  ): string[];
  selectCanvasLayers(
    layerIds: string[],
    primaryLayerId?: string | null,
    options?: { sync?: boolean },
  ): void;
  enterCanvasGroup(groupId: string, leafLayerId?: string | null): boolean;
  enterSelectedCanvasGroup(): boolean;
  exitCanvasGroupIsolation(): boolean;
  getCanvasIsolationPath(): EffectLayer[];
  renderCanvasIsolationBreadcrumb(): void;
}
