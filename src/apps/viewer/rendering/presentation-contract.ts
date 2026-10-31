import type { EditorTemplateSource } from "../templates/model.js";
export type RenderSurfaceTemplate = {
  id?: string;
  effectId?: string;
  kind?: string;
  effectV1?: unknown;
};
export type FramePresentationMetadata = {
  presented?: unknown;
  presentedAtMs?: unknown;
  presentedAtEpochMs?: unknown;
  previewWidth?: unknown;
  previewHeight?: unknown;
};
export type ViewerFrameBuffer = HTMLCanvasElement | OffscreenCanvas;
export interface FramePresentationActions {
  drawCompletedFrame(
    template: EditorTemplateSource,
    bitmap: ImageBitmap | null | undefined,
    progress: number,
    result?: FramePresentationMetadata,
  ): void;
  shouldUseDirectPreviewSurface(
    template: RenderSurfaceTemplate,
    renderPlan: { scale?: number },
  ): boolean;
  createFrameBuffer(width: number, height: number): ViewerFrameBuffer;
  updateRenderStats(
    durationMs: number,
    renderScale?: number,
    previewLatencyMs?: number,
    measureCost?: boolean,
  ): void;
  setRenderStatus(status: "rendering" | "applied" | "failed"): void;
}
