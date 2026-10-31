import type { ViewerAsset } from "../assets/state.js";
import type { EditorTemplate } from "../templates/model.js";
import type { RenderOptions, RenderAssetTransfer } from "./state.js";

export type RenderModelSource = {
  clips?: unknown;
  duration?: number | null;
  layers?: unknown;
  scenes?: unknown;
  timeline?: unknown;
};
export interface RenderModelActions {
  getRenderTemplateSnapshot(
    template?: { id: string } | null,
  ): EditorTemplate | null;
  createRenderModelEnvelope(
    template: RenderModelSource,
  ): Record<string, unknown>;
  commitRenderModelEnvelope(envelope: Record<string, unknown>): void;
  resetRenderModelCache(): void;
}
export interface RenderAssetActions {
  createAssetBitmap(asset: ViewerAsset): Promise<ImageBitmap>;
  createRenderAssets(template: {
    assets?: unknown;
    effectId?: unknown;
    id?: unknown;
  }): Promise<RenderAssetTransfer>;
  commitRenderAssetTransfers(assets: RenderAssetTransfer): void;
  resetRenderAssetCache(): void;
}
export interface RenderServiceActions {
  renderCurrentFrame(options?: RenderOptions): Promise<void>;
  waitForRenderIdle(): Promise<void>;
  resolveRenderIdleWaiters(): void;
  markRendererBinding(element: HTMLElement, type: string, id: unknown): void;
}
export interface PreviewRasterActions {
  getCompositionDesignSize(): { height: number; width: number };
  getPreviewRasterSize(): { height: number; width: number };
  applyPreviewRasterSize(): void;
}
