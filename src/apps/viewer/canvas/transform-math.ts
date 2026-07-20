export interface CanvasTransformPoint {
  x: number;
  y: number;
}

export interface CanvasTransformBox extends CanvasTransformPoint {
  height: number;
  width: number;
}

interface CanvasTransformProperties extends CanvasTransformPoint {
  scaleX: number;
  scaleY: number;
}

const MIN_SCALE = 0.05;
const MAX_SCALE = 8;
const MIN_BOX_SIZE = 0.0001;

export function rotateCanvasVector(
  point: CanvasTransformPoint,
  degrees: number,
): CanvasTransformPoint {
  const radians = (degrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: point.x * cosine - point.y * sine,
    y: point.x * sine + point.y * cosine,
  };
}

export function normalizeCanvasAngleDelta(degrees: number): number {
  return ((((degrees + 180) % 360) + 360) % 360) - 180;
}

export function calculateCanvasResize({
  anchor,
  box,
  delta,
  handle,
  lockAspect,
  original,
  rotation,
}: {
  anchor: CanvasTransformPoint;
  box: CanvasTransformBox;
  delta: CanvasTransformPoint;
  handle: string;
  lockAspect: boolean;
  original: CanvasTransformProperties;
  rotation: number;
}): CanvasTransformProperties {
  const localDelta = rotateCanvasVector(delta, -rotation);
  const affectsX = handle.includes("e") || handle.includes("w");
  const affectsY = handle.includes("n") || handle.includes("s");
  const west = handle.includes("w");
  const north = handle.includes("n");
  const anchorX = 0.5 + anchor.x;
  const anchorY = 0.5 + anchor.y;
  const left = -anchorX * box.width;
  const right = (1 - anchorX) * box.width;
  const top = -anchorY * box.height;
  const bottom = (1 - anchorY) * box.height;
  const rawWidth = affectsX
    ? west
      ? right - (left + localDelta.x)
      : right + localDelta.x - left
    : box.width;
  const rawHeight = affectsY
    ? north
      ? bottom - (top + localDelta.y)
      : bottom + localDelta.y - top
    : box.height;
  let nextScaleX = clamp(
    original.scaleX * (rawWidth / Math.max(MIN_BOX_SIZE, box.width)),
    MIN_SCALE,
    MAX_SCALE,
  );
  let nextScaleY = clamp(
    original.scaleY * (rawHeight / Math.max(MIN_BOX_SIZE, box.height)),
    MIN_SCALE,
    MAX_SCALE,
  );
  if (lockAspect && affectsX && affectsY) {
    const factorX = rawWidth / Math.max(MIN_BOX_SIZE, box.width);
    const factorY = rawHeight / Math.max(MIN_BOX_SIZE, box.height);
    const requestedFactor =
      Math.abs(factorX - 1) >= Math.abs(factorY - 1) ? factorX : factorY;
    const factor = clamp(
      requestedFactor,
      Math.max(MIN_SCALE / original.scaleX, MIN_SCALE / original.scaleY),
      Math.min(MAX_SCALE / original.scaleX, MAX_SCALE / original.scaleY),
    );
    nextScaleX = original.scaleX * factor;
    nextScaleY = original.scaleY * factor;
  }
  const nextWidth =
    box.width * (nextScaleX / Math.max(MIN_SCALE, original.scaleX));
  const nextHeight =
    box.height * (nextScaleY / Math.max(MIN_SCALE, original.scaleY));
  const nextLeft = affectsX ? (west ? right - nextWidth : left) : left;
  const nextTop = affectsY ? (north ? bottom - nextHeight : top) : top;
  const pivot = {
    x: box.x + anchorX * box.width,
    y: box.y + anchorY * box.height,
  };
  const pivotOffset = rotateCanvasVector(
    {
      x: nextLeft + anchorX * nextWidth,
      y: nextTop + anchorY * nextHeight,
    },
    rotation,
  );
  const nextPivot = {
    x: pivot.x + pivotOffset.x,
    y: pivot.y + pivotOffset.y,
  };
  const nextBox = {
    x: nextPivot.x - anchorX * nextWidth,
    y: nextPivot.y - anchorY * nextHeight,
  };
  const baseWidth = box.width / Math.max(MIN_SCALE, original.scaleX);
  const baseHeight = box.height / Math.max(MIN_SCALE, original.scaleY);
  return {
    scaleX: nextScaleX,
    scaleY: nextScaleY,
    x:
      original.x +
      (nextBox.x - box.x) +
      anchorX * baseWidth * (nextScaleX - original.scaleX),
    y:
      original.y +
      (nextBox.y - box.y) +
      anchorY * baseHeight * (nextScaleY - original.scaleY),
  };
}

export function calculateCanvasAnchorMove({
  anchor,
  box,
  delta,
  original,
  rotation,
}: {
  anchor: CanvasTransformPoint;
  box: CanvasTransformBox;
  delta: CanvasTransformPoint;
  original: CanvasTransformProperties;
  rotation: number;
}) {
  const localDelta = rotateCanvasVector(delta, -rotation);
  const nextAnchor = {
    x: clamp(
      anchor.x + localDelta.x / Math.max(MIN_BOX_SIZE, box.width),
      -0.5,
      0.5,
    ),
    y: clamp(
      anchor.y + localDelta.y / Math.max(MIN_BOX_SIZE, box.height),
      -0.5,
      0.5,
    ),
  };
  const anchorDelta = {
    x: (nextAnchor.x - anchor.x) * box.width,
    y: (nextAnchor.y - anchor.y) * box.height,
  };
  const rotatedAnchorDelta = rotateCanvasVector(anchorDelta, rotation);
  const baseWidth = box.width / Math.max(MIN_SCALE, original.scaleX);
  const baseHeight = box.height / Math.max(MIN_SCALE, original.scaleY);
  return {
    anchorX: nextAnchor.x,
    anchorY: nextAnchor.y,
    x:
      original.x +
      rotatedAnchorDelta.x -
      anchorDelta.x -
      (nextAnchor.x - anchor.x) * baseWidth * (1 - original.scaleX),
    y:
      original.y +
      rotatedAnchorDelta.y -
      anchorDelta.y -
      (nextAnchor.y - anchor.y) * baseHeight * (1 - original.scaleY),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
