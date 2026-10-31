import type { PreviewMediaSlot } from "./model.js";
import type { EditorTimelineSource } from "../editor/timeline-source.js";
export interface PreviewMediaActions {
  createPreviewMediaFrame(
    slot: PreviewMediaSlot,
    width: number,
    height: number,
    progress: number,
  ): Promise<ImageBitmap | null>;
  syncPreviewMediaUi(template?: EditorTimelineSource | null): void;
  wirePreviewMediaSession(): void;
}
