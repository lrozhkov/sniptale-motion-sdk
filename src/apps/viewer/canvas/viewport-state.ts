export type CanvasViewportRect = Pick<
  DOMRect,
  "bottom" | "height" | "left" | "right" | "top" | "width"
>;
export type CanvasSelectionViewport = {
  canvasRect: CanvasViewportRect;
  stageRect: CanvasViewportRect;
};

export type CanvasViewportState = {
  canvasMotionPathContextLayerIds: string[];
  canvasSnapStatus: string | null;
  canvasIsolationGroupId: string | null;
  canvasSelectionViewport: CanvasSelectionViewport | null;
};

export function createCanvasViewportState(): CanvasViewportState {
  return {
    canvasMotionPathContextLayerIds: [],
    canvasSnapStatus: null,
    canvasIsolationGroupId: null,
    canvasSelectionViewport: null,
  };
}
