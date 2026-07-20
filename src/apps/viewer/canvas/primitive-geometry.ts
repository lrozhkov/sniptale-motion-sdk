export type CanvasBox = {
  height: number;
  rotation: number;
  width: number;
  x: number;
  y: number;
};

type CanvasAnchor = { x: number; y: number };
type CanvasSize = { height: number; width: number };
type CanvasVector = { x: number; y: number };

export function fitOrientedBoxToPrimitiveBounds({
  anchor,
  primitiveBox,
  referenceBox,
  rotation,
}: {
  anchor: CanvasAnchor;
  primitiveBox: CanvasBox;
  referenceBox: CanvasBox;
  rotation: number;
}): CanvasBox {
  const angle = (finiteNumber(rotation) * Math.PI) / 180;
  const cosine = Math.abs(Math.cos(angle));
  const sine = Math.abs(Math.sin(angle));
  const size = resolveOrientedSize({
    cosine,
    height: primitiveBox.height,
    referenceAspect: referenceBox.width / Math.max(0.0001, referenceBox.height),
    sine,
    width: primitiveBox.width,
  });
  if (!size) {
    return { ...primitiveBox, rotation: 0 };
  }
  const primitiveCenter = {
    x: primitiveBox.x + primitiveBox.width * 0.5,
    y: primitiveBox.y + primitiveBox.height * 0.5,
  };
  const anchorOffset = {
    x: finiteNumber(anchor.x) * size.width,
    y: finiteNumber(anchor.y) * size.height,
  };
  const rotatedAnchorOffset = rotateVector(anchorOffset, angle);
  const unrotatedCenter = {
    x: primitiveCenter.x - anchorOffset.x + rotatedAnchorOffset.x,
    y: primitiveCenter.y - anchorOffset.y + rotatedAnchorOffset.y,
  };
  return {
    height: size.height,
    rotation: finiteNumber(rotation),
    width: size.width,
    x: unrotatedCenter.x - size.width * 0.5,
    y: unrotatedCenter.y - size.height * 0.5,
  };
}

function resolveOrientedSize({
  cosine,
  height,
  referenceAspect,
  sine,
  width,
}: {
  cosine: number;
  height: number;
  referenceAspect: number;
  sine: number;
  width: number;
}): CanvasSize | null {
  const determinant = cosine * cosine - sine * sine;
  if (Math.abs(determinant) > 0.08) {
    const oriented = {
      height: (cosine * height - sine * width) / determinant,
      width: (cosine * width - sine * height) / determinant,
    };
    if (isValidSize(oriented) && reconstructionFits(oriented)) {
      return oriented;
    }
  }
  const aspect =
    Number.isFinite(referenceAspect) && referenceAspect > 0
      ? referenceAspect
      : width / Math.max(0.0001, height);
  const widthFactor = cosine * aspect + sine;
  const heightFactor = sine * aspect + cosine;
  const denominator = widthFactor * widthFactor + heightFactor * heightFactor;
  if (denominator <= 0.0001) {
    return null;
  }
  const orientedHeight =
    (width * widthFactor + height * heightFactor) / denominator;
  const oriented = {
    height: orientedHeight,
    width: orientedHeight * aspect,
  };
  return isValidSize(oriented) ? oriented : null;

  function reconstructionFits(size: CanvasSize): boolean {
    const reconstructedWidth = cosine * size.width + sine * size.height;
    const reconstructedHeight = sine * size.width + cosine * size.height;
    const widthError =
      Math.abs(reconstructedWidth - width) / Math.max(1, width);
    const heightError =
      Math.abs(reconstructedHeight - height) / Math.max(1, height);
    return Math.max(widthError, heightError) <= 0.04;
  }
}

function isValidSize(size: CanvasSize): boolean {
  return (
    Number.isFinite(size.width) &&
    Number.isFinite(size.height) &&
    size.width > 0.01 &&
    size.height > 0.01
  );
}

function rotateVector(vector: CanvasVector, angle: number): CanvasVector {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    x: vector.x * cosine - vector.y * sine,
    y: vector.x * sine + vector.y * cosine,
  };
}

function finiteNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}
