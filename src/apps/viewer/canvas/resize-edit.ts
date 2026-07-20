import {
  resolveLayerCanvasResizeProperty,
  type LayerEditorCapabilities,
} from "../layers/editor-capabilities.js";
import { rotateCanvasVector } from "./transform-math.js";

const MIN_AUTHOR_SIZE = 8;
const MAX_AUTHOR_SIZE = 4000;
const CHANGE_EPSILON = 0.000001;

type ResizeEditInput = {
  anchor: { x: number; y: number };
  authorBox: { height: number; width: number; x: number; y: number };
  box: { height: number; width: number; x: number; y: number };
  capabilities: LayerEditorCapabilities;
  handle: string;
  layer: Record<string, unknown>;
  next: ResizeTransformValues;
  original: ResizeTransformValues;
  rotation: number;
};

type ResizeTransformValues = {
  scaleX: number;
  scaleY: number;
  x: number;
  y: number;
};

export function resolveCanvasResizeEdit({
  anchor,
  authorBox,
  box,
  capabilities,
  handle,
  layer,
  next,
  original,
  rotation,
}: ResizeEditInput): Record<string, number> {
  const edit: Record<string, number> = {};
  const affectsX = handle.includes("e") || handle.includes("w");
  const affectsY = handle.includes("n") || handle.includes("s");
  let dimensionFactorX = 1;
  let dimensionFactorY = 1;

  if (affectsX) {
    const property = resolveLayerCanvasResizeProperty(capabilities, "x");
    if (property === "width") {
      const resolved = resolveAuthorSize({
        authored: layer.width,
        boxSize: authorBox.width,
        nextScale: next.scaleX,
        originalScale: original.scaleX,
      });
      edit.width = resolved.size;
      dimensionFactorX = resolved.size / resolved.baseSize;
    } else if (property === "scaleX") {
      addChanged(edit, "scaleX", next.scaleX, original.scaleX);
    }
  }
  if (affectsY) {
    const property = resolveLayerCanvasResizeProperty(capabilities, "y");
    if (property === "height") {
      const resolved = resolveAuthorSize({
        authored: layer.height,
        boxSize: authorBox.height,
        nextScale: next.scaleY,
        originalScale: original.scaleY,
      });
      edit.height = resolved.size;
      dimensionFactorY = resolved.size / resolved.baseSize;
    } else if (property === "scaleY") {
      addChanged(edit, "scaleY", next.scaleY, original.scaleY);
    }
  }
  const correction = resolveDimensionPivotCorrection({
    anchor,
    authorBox,
    box,
    dimensionFactorX,
    dimensionFactorY,
    rotation,
  });
  if (capabilities.transform.includes("x")) {
    setChanged(edit, "x", next.x + correction.x, original.x);
  }
  if (capabilities.transform.includes("y")) {
    setChanged(edit, "y", next.y + correction.y, original.y);
  }
  return edit;
}

function resolveAuthorSize({
  authored,
  boxSize,
  nextScale,
  originalScale,
}: {
  authored: unknown;
  boxSize: number;
  nextScale: number;
  originalScale: number;
}): { baseSize: number; size: number } {
  const safeOriginalScale = Math.max(0.05, Number(originalScale) || 1);
  const authoredSize = Number(authored);
  const baseSize =
    Number.isFinite(authoredSize) && authoredSize > 0
      ? authoredSize
      : Number(boxSize) / safeOriginalScale;
  return {
    baseSize,
    size: Math.round(
      clamp(
        baseSize * (Math.max(0.05, Number(nextScale) || 1) / safeOriginalScale),
        MIN_AUTHOR_SIZE,
        MAX_AUTHOR_SIZE,
      ),
    ),
  };
}

function resolveDimensionPivotCorrection({
  anchor,
  authorBox,
  box,
  dimensionFactorX,
  dimensionFactorY,
  rotation,
}: {
  anchor: { x: number; y: number };
  authorBox: { height: number; width: number; x: number; y: number };
  box: { height: number; width: number; x: number; y: number };
  dimensionFactorX: number;
  dimensionFactorY: number;
  rotation: number;
}): { x: number; y: number } {
  if (
    Math.abs(dimensionFactorX - 1) <= CHANGE_EPSILON &&
    Math.abs(dimensionFactorY - 1) <= CHANGE_EPSILON
  ) {
    return { x: 0, y: 0 };
  }
  const anchorX = 0.5 + Number(anchor.x || 0);
  const anchorY = 0.5 + Number(anchor.y || 0);
  const primitivePivot = {
    x: box.x + anchorX * box.width,
    y: box.y + anchorY * box.height,
  };
  const authorPivot = {
    x: authorBox.x + anchorX * authorBox.width,
    y: authorBox.y + anchorY * authorBox.height,
  };
  const localOffset = rotateCanvasVector(
    {
      x: primitivePivot.x - authorPivot.x,
      y: primitivePivot.y - authorPivot.y,
    },
    -rotation,
  );
  return rotateCanvasVector(
    {
      x: (1 - dimensionFactorX) * localOffset.x,
      y: (1 - dimensionFactorY) * localOffset.y,
    },
    rotation,
  );
}

function addChanged(
  target: Record<string, number>,
  property: string,
  next: number,
  original: number,
): void {
  if (Math.abs(Number(next) - Number(original)) > CHANGE_EPSILON) {
    target[property] = Number(next);
  }
}

function setChanged(
  target: Record<string, number>,
  property: string,
  next: number,
  original: number,
): void {
  if (Math.abs(Number(next) - Number(original)) <= CHANGE_EPSILON) {
    delete target[property];
    return;
  }
  target[property] = Number(next);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
