import type { ViewerAppContext } from "../app/context.js";

import type { LayerNumericPropertyRange } from "./property-range-model.js";

const BUILTIN_NUMERIC_RANGES = new Map<string, LayerNumericPropertyRange>([
  ["anchorX", { max: 0.5, min: -0.5 }],
  ["anchorY", { max: 0.5, min: -0.5 }],
  ["blur", { max: 40, min: 0 }],
  ["opacity", { max: 1, min: 0 }],
  ["rotation", { max: 360, min: -360 }],
  ["scaleX", { max: 8, min: 0.05 }],
  ["scaleY", { max: 8, min: 0.05 }],
  ["x", { max: 4000, min: -4000 }],
  ["y", { max: 4000, min: -4000 }],
]);

export function getTrackNumericPropertyRange(
  ctx: ViewerAppContext,
  template,
  track,
): LayerNumericPropertyRange | null {
  const property =
    ctx.inferTrackProperty?.(track) ??
    track?.property ??
    (typeof track?.id === "string" && track.id.includes(".")
      ? track.id.split(".").slice(1).join(".")
      : null);
  if (!property) {
    return null;
  }
  const layerId =
    ctx.getTrackLayerId?.(track) ??
    track?.layerId ??
    (typeof track?.target === "string" && track.target !== "scene"
      ? track.target
      : null);
  const layer = layerId
    ? template?.layers?.find((entry) => entry.id === layerId)
    : null;
  const contentField = layer
    ? (ctx.getLayerContentFields?.(layer) ?? []).find(
        (field) =>
          field.kind === "number" &&
          field.property === property &&
          Number.isFinite(field.min) &&
          Number.isFinite(field.max),
      )
    : null;
  if (contentField?.kind === "number") {
    return { max: contentField.max, min: contentField.min };
  }
  return BUILTIN_NUMERIC_RANGES.get(property) ?? null;
}

export function clampTrackNumericValue(
  value: number,
  range: LayerNumericPropertyRange | null,
): number {
  if (!range) {
    return value;
  }
  return Math.min(range.max, Math.max(range.min, value));
}
