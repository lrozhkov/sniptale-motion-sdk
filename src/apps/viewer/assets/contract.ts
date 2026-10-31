import type { EffectLayer } from "../../../sdk/types.js";
import type { ViewerAsset } from "./state.js";
import type { EditorTimelineSource } from "../editor/timeline-source.js";

export type AssetLayerPlacement = {
  canvasPoint?: { x: number; y: number };
  canvasWidth?: number;
  canvasHeight?: number;
};
export type CreatedAssetLayer = EffectLayer & {
  assetId: string;
  opacity: number;
  width: number;
  height: number;
  x: number;
  y: number;
};
export interface AssetPanelActions {
  handleAssetDragOver(event: DragEvent): void;
  handleAssetDrop(event: DragEvent): void;
  renderAssetsPanel(template?: EditorTimelineSource | null): void;
  selectAsset(assetId: string): void;
  renameAssetPath(assetId: string, path: string): void;
  removeAssetIfUnused(assetId: string): void;
}
export interface AssetBindingActions {
  addAssetLayer(
    this: void,
    asset: ViewerAsset,
    options?: Pick<AssetLayerPlacement, "canvasPoint">,
  ): void;
  replaceAsset(asset: ViewerAsset): void;
  prepareImportedAssets(assets: unknown): Map<string, ViewerAsset>;
  verifyImportedAssets(assets: ReadonlyMap<string, ViewerAsset>): Promise<void>;
}

export interface AssetFileImportActions {
  createAuthorAssetFromFile(
    file: File,
    options?: { assetId?: string },
  ): Promise<ViewerAsset>;
  replaceSelectedAssetFile(): Promise<void>;
}
