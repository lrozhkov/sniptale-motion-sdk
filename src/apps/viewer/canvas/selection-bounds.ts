import type { ViewerAppContext } from "../app/context.js";
import { rotateCanvasVector } from "./transform-math.js";

export type CanvasSelectionBounds = {
  box: {
    height: number;
    rotation: number;
    width: number;
    x: number;
    y: number;
  };
  entries: CanvasSelectionBoundsEntry[];
};

export type CanvasSelectionBoundsEntry = {
  box: any;
  layer: any;
  layerId: string;
  pivot: any;
};

export function resolveCanvasSelectionBounds(
  ctx: ViewerAppContext,
  template,
  layerIds: string[],
  resolution: any = {},
): CanvasSelectionBounds | null {
  const entries: CanvasSelectionBoundsEntry[] = [];
  for (const layerId of layerIds) {
    const layer = template.layers.find((item) => item.id === layerId);
    if (!layer || !ctx.isLayerCanvasSelectable(layer)) {
      continue;
    }
    const box = ctx.getLayerCanvasBox(layerId, layer, resolution);
    if (!box) {
      continue;
    }
    entries.push({
      box,
      layer,
      layerId,
      pivot: ctx.getLayerCanvasPivot(box, layer),
    });
  }
  const boxes = entries.map(({ box, pivot }) =>
    getAxisAlignedCanvasBox(box, pivot),
  );
  if (boxes.length === 0) {
    return null;
  }
  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.width));
  const maxY = Math.max(...boxes.map((box) => box.y + box.height));
  return {
    box: {
      height: maxY - minY,
      rotation: 0,
      width: maxX - minX,
      x: minX,
      y: minY,
    },
    entries,
  };
}

export function getAxisAlignedCanvasBox(box, pivot) {
  const corners = [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height },
  ].map((point) => {
    const rotated = rotateCanvasVector(
      { x: point.x - pivot.x, y: point.y - pivot.y },
      Number(box.rotation) || 0,
    );
    return { x: pivot.x + rotated.x, y: pivot.y + rotated.y };
  });
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { height: maxY - minY, width: maxX - minX, x: minX, y: minY };
}
