import type { EffectLayer } from "../../../sdk/types.js";
import type { LayerEditorCapabilities } from "../layers/editor-capabilities.js";
import type { CanvasPoint } from "./geometry-contract.js";
import type { CanvasBox } from "./primitive-geometry.js";
import type { CanvasViewportRect } from "./viewport-state.js";
export type CanvasSelectionDisplayOptions = {
  playbackFrame?: boolean;
  motionPath?: boolean;
};
export type CanvasHandleDisplaySize = {
  height?: number;
  width?: number;
  multiSelection?: boolean;
};
export interface CanvasDisplayActions {
  updateCanvasSelectionBox(options?: CanvasSelectionDisplayOptions): void;
  observeCanvasSelectionViewport(): void;
  scheduleCanvasSelectionPlaybackUpdate(): void;
  ensureCanvasTransformHandles(
    capabilities: LayerEditorCapabilities,
    rotation?: number,
    displaySize?: CanvasHandleDisplaySize,
  ): void;
  updateCanvasAnchorHandle(anchor: CanvasPoint): void;
  hideCanvasInfoHud(): void;
  updateCanvasInfoHud(
    layer: EffectLayer,
    box: CanvasBox,
    canvasRect: CanvasViewportRect,
    stageRect: CanvasViewportRect,
    scaleX: number,
    scaleY: number,
    options?: { active?: boolean; selectionCount?: number },
  ): void;
  getCanvasSnapStatusForBox(box: CanvasBox, layer?: EffectLayer | null): string;
}
