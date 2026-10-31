import type {
  EditorTemplate,
  EditorTemplateSource,
} from "../templates/model.js";
import type { PreviewMediaSlot } from "../preview-media/model.js";
import type { RendererBindingReads } from "../app/binding-reads.js";
import type { RenderOptions } from "./state.js";

export type ViewerDrawingContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;
export type RenderInputFrames = {
  frames: Partial<Record<PreviewMediaSlot, ImageBitmap>>;
  transfer: ImageBitmap[];
};
export type ExportFrameOptions = {
  controls?: Record<string, unknown>;
  frameIndex: number;
  fps: number;
  height: number;
  time: number;
  width: number;
};
export type ScaledRenderSize = { height: number; width: number; scale: number };
export interface ViewerRenderOutputActions {
  createRenderInputFrames(
    template: unknown,
    width: number,
    height: number,
    progress: number,
  ): Promise<RenderInputFrames>;
  getPreviewRenderPlan(
    width: number,
    height: number,
    options?: RenderOptions,
  ): ScaledRenderSize & { renderQuality: "full" };
  getContractRenderSize(width: number, height: number): ScaledRenderSize;
  normalizePreviewBindingReads(reads: unknown): RendererBindingReads;
  syncPreviewQualityBadge(scale: number): void;
  refinePreviewAtFullQuality(): Promise<boolean>;
  settlePreviewAfterInteraction(): Promise<boolean>;
  renderFrameBitmapForExport(
    template: EditorTemplateSource,
    effectiveTemplate: EditorTemplate,
    options: ExportFrameOptions,
  ): Promise<ImageBitmap>;
  drawExportFrame(
    context: ViewerDrawingContext,
    template: EditorTemplateSource,
    bitmap: ImageBitmap,
    progress: number,
  ): void;
}
