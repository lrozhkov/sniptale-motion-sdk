import type { BindingReads } from "./binding-reads.js";

export type RuntimeCanvas = (HTMLCanvasElement | OffscreenCanvas) & {
  __sniptaleLogicalHeight?: number;
  __sniptaleLogicalWidth?: number;
};

export type RuntimeCanvasContext = (
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D
) & {
  __sniptaleBindingReads?: BindingReads | null;
};

export type PrimitiveLayerReference = {
  layerId?: string;
  layer?: string;
  targetLayerId?: string;
};

export type CanvasSurfaceContext = {
  __sniptaleLogicalScaleX?: number;
  __sniptaleLogicalScaleY?: number;
  reset?: () => void;
  setTransform?: (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
  ) => void;
};
export type CanvasSurface = {
  width: number;
  height: number;
  __sniptaleLogicalHeight?: number;
  __sniptaleLogicalWidth?: number;
  getContext(
    kind: "2d",
    options?: { desynchronized?: boolean },
  ): CanvasSurfaceContext | null;
};
export type CanvasFactory<T extends CanvasSurface = RuntimeCanvas> = (
  width: number,
  height: number,
) => T;
