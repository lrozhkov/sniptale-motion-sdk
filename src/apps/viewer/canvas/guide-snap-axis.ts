export interface CanvasGuide {
  label: string;
  value: number;
}

export interface CanvasGuideSnapLock {
  anchorOffset: number;
  guide: CanvasGuide;
}

export interface CanvasGuideSnapOptions {
  captureCoreTolerance?: number;
  captureTolerance: number;
  lockedGuide?: CanvasGuide | null;
  releaseBlendTolerance?: number;
  releaseTolerance: number;
}

export interface CanvasGuideAnchorSnapOptions extends Omit<
  CanvasGuideSnapOptions,
  "lockedGuide"
> {
  lock?: CanvasGuideSnapLock | null;
}

export function resolveCanvasGuideSnap(
  value: number,
  guides: CanvasGuide[],
  options: CanvasGuideSnapOptions,
) {
  const {
    captureTolerance,
    lockedGuide = null,
    releaseBlendTolerance = 0,
    releaseTolerance,
  } = options;
  if (lockedGuide) {
    const distance = Math.abs(lockedGuide.value - value);
    if (distance <= releaseTolerance) {
      return {
        delta: lockedGuide.value - value,
        distance,
        guide: lockedGuide,
        locked: true,
        snapped: true,
      };
    }
    const blendTolerance = Math.max(0, Number(releaseBlendTolerance) || 0);
    if (blendTolerance > 0 && distance < releaseTolerance + blendTolerance) {
      const blendProgress = (distance - releaseTolerance) / blendTolerance;
      const easedProgress = smoothStep(blendProgress);
      return {
        delta: (lockedGuide.value - value) * (1 - easedProgress),
        distance,
        guide: lockedGuide,
        locked: true,
        snapped: true,
      };
    }
  }

  let nearest: CanvasGuide | null = null;
  let nearestDistance = Infinity;
  for (const guide of guides) {
    const distance = Math.abs(guide.value - value);
    if (distance < nearestDistance && distance <= captureTolerance) {
      nearest = guide;
      nearestDistance = distance;
    }
  }
  if (!nearest) {
    return createNoCanvasGuideSnap();
  }
  const captureCore = Math.min(
    captureTolerance,
    Math.max(0, Number(options.captureCoreTolerance ?? captureTolerance) || 0),
  );
  if (nearestDistance <= captureCore || captureCore >= captureTolerance) {
    return {
      delta: nearest.value - value,
      distance: nearestDistance,
      guide: nearest,
      locked: true,
      snapped: true,
    };
  }
  const captureProgress =
    (nearestDistance - captureCore) / (captureTolerance - captureCore);
  return {
    delta: (nearest.value - value) * (1 - smoothStep(captureProgress)),
    distance: nearestDistance,
    guide: nearest,
    locked: false,
    snapped: true,
  };
}

export function resolveCanvasGuideSnapForAnchors(
  position: number,
  anchorOffsets: number[],
  guides: CanvasGuide[],
  options: CanvasGuideAnchorSnapOptions,
) {
  const lock = options.lock ?? null;
  if (lock) {
    const held = resolveCanvasGuideSnap(
      position + lock.anchorOffset,
      [lock.guide],
      { ...options, lockedGuide: lock.guide },
    );
    if (held.snapped) {
      return {
        ...held,
        anchorOffset: lock.anchorOffset,
        lock,
      };
    }
    // Do not acquire a different anchor in the same pointer sample. This gives
    // the released object one raw-position frame and prevents visible jumps.
    return { ...createNoCanvasGuideSnap(), anchorOffset: null, lock: null };
  }

  let nearestAnchorOffset: number | null = null;
  let nearestGuide: CanvasGuide | null = null;
  let nearestDistance = Infinity;
  for (const anchorOffset of anchorOffsets.length > 0 ? anchorOffsets : [0]) {
    const value = position + anchorOffset;
    for (const guide of guides) {
      const distance = Math.abs(guide.value - value);
      if (distance < nearestDistance && distance <= options.captureTolerance) {
        nearestAnchorOffset = anchorOffset;
        nearestGuide = guide;
        nearestDistance = distance;
      }
    }
  }
  if (nearestAnchorOffset === null || !nearestGuide) {
    return { ...createNoCanvasGuideSnap(), anchorOffset: null, lock: null };
  }
  const snap = resolveCanvasGuideSnap(
    position + nearestAnchorOffset,
    [nearestGuide],
    options,
  );
  return {
    ...snap,
    anchorOffset: nearestAnchorOffset,
    lock: snap.locked
      ? { anchorOffset: nearestAnchorOffset, guide: nearestGuide }
      : null,
  };
}

export function getCanvasSnapAnchorValues(box, pivot) {
  const rotation = Number(box.rotation) || 0;
  const corners = [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height },
  ].map((point) => {
    const offset = rotateCanvasVector(
      { x: point.x - pivot.x, y: point.y - pivot.y },
      rotation,
    );
    return { x: pivot.x + offset.x, y: pivot.y + offset.y };
  });
  const x = corners.map((point) => point.x);
  const y = corners.map((point) => point.y);
  const minX = Math.min(...x);
  const maxX = Math.max(...x);
  const minY = Math.min(...y);
  const maxY = Math.max(...y);
  return {
    x: uniqueCanvasSnapAnchors([(minX + maxX) / 2, minX, maxX]),
    y: uniqueCanvasSnapAnchors([(minY + maxY) / 2, minY, maxY]),
  };
}

function createNoCanvasGuideSnap() {
  return {
    delta: 0,
    distance: Infinity,
    guide: null,
    locked: false,
    snapped: false,
  };
}

function uniqueCanvasSnapAnchors(values: number[]) {
  return values.filter(
    (value, index) =>
      values.findIndex((candidate) => Math.abs(candidate - value) < 0.0001) ===
      index,
  );
}

function smoothStep(value: number): number {
  const progress = Math.min(1, Math.max(0, value));
  return progress * progress * (3 - 2 * progress);
}
import { rotateCanvasVector } from "./transform-math.js";
