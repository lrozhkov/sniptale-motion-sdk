import type { EffectLayer } from "../../../sdk/types.js";
import type { LayerHierarchyIndex } from "./hierarchy.js";

export type LayerHierarchySource = { layers: readonly EffectLayer[] };
export interface LayerHierarchyActions {
  getLayerHierarchy(
    template?: LayerHierarchySource | null,
  ): LayerHierarchyIndex<EffectLayer>;
  getSelectedLayerRootIds(template?: LayerHierarchySource | null): string[];
  getSelectedLayerLeafIds(template?: LayerHierarchySource | null): string[];
  setSelectedLayers(
    layerIds: string[],
    template?: LayerHierarchySource | null,
  ): void;
}
