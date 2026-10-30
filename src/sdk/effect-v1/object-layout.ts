import type { EffectV1ObjectLayout } from "./types.js";

export const EFFECT_V1_OBJECT_MAX_SIZE = 16384;

/** A stable object box, independent of animation time and raster resolution. */
export function resolveEffectV1ObjectLayout(
  layout: EffectV1ObjectLayout,
  available: { width: number; height: number } = layout,
): { width: number; height: number } {
  for (const value of [
    layout.width,
    layout.height,
    available.width,
    available.height,
  ]) {
    if (
      !Number.isFinite(value) ||
      value < 1 ||
      value > EFFECT_V1_OBJECT_MAX_SIZE
    ) {
      throw new Error("Object layout dimensions must be between 1 and 16384.");
    }
  }
  if (layout.resize === "reflow") {
    return { width: available.width, height: available.height };
  }
  if (layout.resize !== "scale")
    throw new Error("Unknown object resize policy.");
  const scale = Math.min(
    available.width / layout.width,
    available.height / layout.height,
  );
  return { width: layout.width * scale, height: layout.height * scale };
}
