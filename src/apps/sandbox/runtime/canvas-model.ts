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
