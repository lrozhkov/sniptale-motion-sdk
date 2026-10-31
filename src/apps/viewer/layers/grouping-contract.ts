export type LayerGroupingState = {
  canGroup: boolean;
  canUngroup: boolean;
  groupReason: string | null;
};
export interface LayerGroupingActions {
  getLayerGroupingState(): LayerGroupingState;
  groupSelectedLayers(): boolean;
  ungroupSelectedLayers(): boolean;
}
