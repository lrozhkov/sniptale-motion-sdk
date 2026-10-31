import type { CanvasBox } from "./primitive-geometry.js";
import { getAxisAlignedCanvasBox } from "./selection-bounds.js";
import { rotateCanvasVector } from "./transform-math.js";

export type CanvasSelectionTransformEntry = {
  anchor: { x: number; y: number };
  box: {
    height: number;
    rotation: number;
    width: number;
    x: number;
    y: number;
  };
  layerId: string;
  pivot: { x: number; y: number };
  values: {
    rotation: number;
    scaleX: number;
    scaleY: number;
    x: number;
    y: number;
  };
};

export type CanvasSelectionTransformResult = {
  box: {
    height: number;
    rotation: number;
    width: number;
    x: number;
    y: number;
  };
  boxes: Record<string, CanvasBox>;
  updates: Record<string, Record<string, number>>;
};

export function transformCanvasSelection(
  entries: CanvasSelectionTransformEntry[],
  options: {
    pivot: { x: number; y: number };
    rotation?: number;
    scale?: number;
    translation?: { x: number; y: number };
  },
): CanvasSelectionTransformResult {
  const rotation = Number(options.rotation) || 0;
  const scale = Math.max(0.05, Number(options.scale) || 1);
  const translation = options.translation ?? { x: 0, y: 0 };
  const boxes: Record<string, CanvasBox> = {};
  const updates: Record<string, Record<string, number>> = {};
  const axisAlignedBoxes: Omit<CanvasBox, "rotation">[] = [];
  for (const entry of entries) {
    const pivotOffset = rotateCanvasVector(
      {
        x: (entry.pivot.x - options.pivot.x) * scale,
        y: (entry.pivot.y - options.pivot.y) * scale,
      },
      rotation,
    );
    const nextPivot = {
      x: options.pivot.x + translation.x + pivotOffset.x,
      y: options.pivot.y + translation.y + pivotOffset.y,
    };
    const nextBox = {
      height: entry.box.height * scale,
      rotation: entry.box.rotation + rotation,
      width: entry.box.width * scale,
      x: nextPivot.x - (0.5 + entry.anchor.x) * entry.box.width * scale,
      y: nextPivot.y - (0.5 + entry.anchor.y) * entry.box.height * scale,
    };
    boxes[entry.layerId] = nextBox;
    axisAlignedBoxes.push(getAxisAlignedCanvasBox(nextBox, nextPivot));
    updates[entry.layerId] = {
      rotation: entry.values.rotation + rotation,
      scaleX: entry.values.scaleX * scale,
      scaleY: entry.values.scaleY * scale,
      x: entry.values.x + (nextPivot.x - entry.pivot.x),
      y: entry.values.y + (nextPivot.y - entry.pivot.y),
    };
  }
  const minX = Math.min(...axisAlignedBoxes.map((box) => box.x));
  const minY = Math.min(...axisAlignedBoxes.map((box) => box.y));
  const maxX = Math.max(...axisAlignedBoxes.map((box) => box.x + box.width));
  const maxY = Math.max(...axisAlignedBoxes.map((box) => box.y + box.height));
  return {
    box: {
      height: maxY - minY,
      rotation: 0,
      width: maxX - minX,
      x: minX,
      y: minY,
    },
    boxes,
    updates,
  };
}

export function resolveCanvasSelectionScaleFactor(
  entries: CanvasSelectionTransformEntry[],
  requestedFactor: number,
): number {
  let minFactor = 0.05;
  let maxFactor = 8;
  for (const entry of entries) {
    minFactor = Math.max(
      minFactor,
      0.05 / Math.max(0.05, entry.values.scaleX),
      0.05 / Math.max(0.05, entry.values.scaleY),
    );
    maxFactor = Math.min(
      maxFactor,
      8 / Math.max(0.05, entry.values.scaleX),
      8 / Math.max(0.05, entry.values.scaleY),
    );
  }
  return Math.min(maxFactor, Math.max(minFactor, requestedFactor));
}
