import { unionPrimitiveBounds } from "../../../shared/geometry/primitive-bounds.js";
import type { PrimitiveBindingBounds } from "../app/binding-reads.js";
type BoundsCandidate = Omit<PrimitiveBindingBounds, "layerId"> & {
  layerId?: string;
};

export function mergePrimitiveBounds(
  current: readonly BoundsCandidate[] = [],
  next: readonly BoundsCandidate[] = [],
): PrimitiveBindingBounds[] {
  const byLayer = new Map<string, PrimitiveBindingBounds>();
  for (const bounds of [...current, ...next]) {
    if (!hasLayerId(bounds)) {
      continue;
    }
    const previous = byLayer.get(bounds.layerId);
    byLayer.set(
      bounds.layerId,
      previous ? unionPrimitiveBounds(previous, bounds) : bounds,
    );
  }
  return Array.from(byLayer.values()).sort((a, b) =>
    a.layerId.localeCompare(b.layerId),
  );
}

function hasLayerId(bounds: BoundsCandidate): bounds is PrimitiveBindingBounds {
  return typeof bounds?.layerId === "string" && bounds.layerId !== "";
}
