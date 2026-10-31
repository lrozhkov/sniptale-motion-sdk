import type { CanvasBox } from "./primitive-geometry.js";

export type CanvasTransformValues = {
  anchorX: number;
  anchorY: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  x: number;
  y: number;
};
type TransformPreviewBase = {
  awaitingFullRender: boolean;
  templateId: string | null;
};
export type CanvasTransformPreview = TransformPreviewBase &
  (
    | {
        box: CanvasBox;
        initialBox: CanvasBox;
        layerId: string;
        original: CanvasTransformValues;
        boxes?: never;
      }
    | {
        boxes: Record<string, CanvasBox>;
        box?: never;
        initialBox?: never;
        layerId?: never;
        original?: never;
      }
  );
export type CanvasTransformState = {
  canvasTransformDragActive: boolean;
  canvasTransformPreview: CanvasTransformPreview | null;
};
export function createCanvasTransformState(): CanvasTransformState {
  return { canvasTransformDragActive: false, canvasTransformPreview: null };
}
