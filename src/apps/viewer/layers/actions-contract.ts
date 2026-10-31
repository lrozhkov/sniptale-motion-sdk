import type { EffectLayer } from "../../../sdk/types.js";
import type { MotionPathTrack } from "../../../shared/timeline/motion-path.js";
import type { EditorTimeline } from "../editor/model-types.js";
import type { EditorTemplateSource } from "../templates/model.js";
import type { TrackLayerSource } from "./model.js";
export type LayerAlignment =
  | "bottom"
  | "horizontal-center"
  | "left"
  | "right"
  | "top"
  | "vertical-center";
export interface LayerOperationActions {
  createUniqueLayerId(
    kind: string,
    layers: readonly Pick<EffectLayer, "id">[],
  ): string;
  duplicateSelectedLayers(): void;
  duplicateSelectedLayer(): void;
  deleteSelectedLayers(): void;
  deleteSelectedLayer(): void;
  createDuplicateLayerId(
    layer: EffectLayer,
    layers: readonly EffectLayer[],
  ): string;
  duplicateLayerTracks(
    timeline: EditorTimeline,
    sourceLayerId: string,
    newLayerId: string,
  ): MotionPathTrack[];
  isTrackOwnedByLayer(track: TrackLayerSource, layerId: string): boolean;
  beginLayerPanelDrag(event: PointerEvent, layerId: string): void;
  moveSelectedLayerOrder(direction: number): void;
  toggleLayerVisibility(layerId: string): void;
  toggleLayerLock(layerId: string): void;
  hasLayerPropertyKeyframeAtCurrentTime(
    layerId: string,
    property: string,
  ): boolean;
  toggleLayerPropertyKeyframe(layerId: string, property: string): void;
  isLayerActiveAtTime(
    template: Pick<EditorTemplateSource, "clips"> | null | undefined,
    layerId: string,
    time: number,
  ): boolean;
  alignLayerSelection(alignment: LayerAlignment): boolean;
  distributeLayerSelection(axis: "horizontal" | "vertical"): boolean;
  focusLayer(layerId: string, preferredTab?: string | null): void;
}
