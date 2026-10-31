import type { SvgPartTransformResult } from "./svg-part-model.js";
import type { SvgVectorAsset, SvgDrawOptions } from "./svg-vector-model.js";

export function readSvgVectorAsset(value: unknown): SvgVectorAsset | null {
  if (value == null) return null;
  if (!isRecord(value)) throw new Error("Expected an SVG asset object.");
  const result: SvgVectorAsset = {};
  for (const key of ["id", "cacheKey", "svgText"] as const) {
    const field = value[key];
    if (field === undefined) continue;
    if (typeof field !== "string") throw new Error(`Invalid SVG asset ${key}.`);
    result[key] = field;
  }
  for (const key of ["width", "height"] as const) {
    const field = value[key];
    if (field === undefined || field === null) continue;
    result[key] = finite(field, key);
  }
  if (value.svgVector !== undefined) result.svgVector = value.svgVector;
  if (value.bitmap != null) {
    if (
      typeof ImageBitmap === "undefined" ||
      !(value.bitmap instanceof ImageBitmap)
    )
      throw new Error("SVG fallback requires a native ImageBitmap.");
    result.bitmap = value.bitmap;
  }
  return result;
}

export function readSvgDrawOptions(value: unknown): SvgDrawOptions {
  if (value == null) return {};
  if (!isRecord(value)) throw new Error("Expected SVG drawing options.");
  const result: SvgDrawOptions = {};
  for (const key of [
    "alpha",
    "height",
    "width",
    "x",
    "y",
    "opacity",
    "rotate",
    "scale",
    "shadowBlur",
  ] as const) {
    if (value[key] !== undefined) result[key] = finite(value[key], key);
  }
  for (const key of [
    "filter",
    "shadowColor",
    "layerId",
    "layer",
    "targetLayerId",
  ] as const) {
    const field = value[key];
    if (field === undefined) continue;
    if (typeof field !== "string")
      throw new Error(`Invalid SVG drawing ${key}.`);
    result[key] = field;
  }
  if (value.composite !== undefined)
    result.composite = composite(value.composite);
  if (value.fit !== undefined) {
    if (
      value.fit !== "contain" &&
      value.fit !== "cover" &&
      value.fit !== "fill"
    )
      throw new Error("Invalid SVG drawing fit.");
    result.fit = value.fit;
  }
  for (const key of ["partIds", "partGroups"] as const) {
    const field: unknown = value[key];
    if (field === undefined) continue;
    if (!Array.isArray(field)) throw new Error(`Invalid SVG drawing ${key}.`);
    const entries: unknown[] = field;
    const strings = entries.filter(
      (entry): entry is string => typeof entry === "string",
    );
    if (strings.length !== entries.length)
      throw new Error(`Invalid SVG drawing ${key}.`);
    result[key] = strings;
  }
  if (value.partFilter !== undefined) {
    if (!isCallable(value.partFilter))
      throw new Error("Invalid SVG part filter.");
    result.partFilter = value.partFilter;
  }
  if (value.partTransform !== undefined) {
    if (!isCallable(value.partTransform))
      throw new Error("Invalid SVG part transform.");
    result.partTransform = value.partTransform;
  }
  return result;
}

export function readSvgPartTransformResult(
  value: unknown,
): SvgPartTransformResult {
  rejectAsyncCallbackResult(value);
  if (value == null) return {};
  if (!isRecord(value))
    throw new Error("Expected an SVG part transform result.");
  const result: SvgPartTransformResult = {};
  for (const key of [
    "alpha",
    "originX",
    "originY",
    "rotate",
    "scale",
    "x",
    "y",
  ] as const) {
    if (value[key] !== undefined) result[key] = finite(value[key], key);
  }
  if (value.filter !== undefined) {
    if (typeof value.filter !== "string")
      throw new Error("Invalid SVG part filter result.");
    result.filter = value.filter;
  }
  if (value.composite !== undefined)
    result.composite = composite(value.composite);
  return result;
}

function finite(value: unknown, key: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`Invalid SVG numeric ${key}.`);
  return value;
}
function composite(value: unknown): GlobalCompositeOperation {
  switch (value) {
    case "source-over":
    case "source-in":
    case "source-out":
    case "source-atop":
    case "destination-over":
    case "destination-in":
    case "destination-out":
    case "destination-atop":
    case "lighter":
    case "copy":
    case "xor":
    case "multiply":
    case "screen":
    case "overlay":
    case "darken":
    case "lighten":
    case "color-dodge":
    case "color-burn":
    case "hard-light":
    case "soft-light":
    case "difference":
    case "exclusion":
    case "hue":
    case "saturation":
    case "color":
    case "luminosity":
      return value;
    default:
      throw new Error("Invalid SVG composite operation.");
  }
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isCallable(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === "function";
}

export function readSvgPartFilterResult(value: unknown): boolean {
  rejectAsyncCallbackResult(value);
  return Boolean(value);
}
function rejectAsyncCallbackResult(value: unknown): void {
  if (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    "then" in value &&
    typeof value.then === "function"
  ) {
    void Promise.resolve(value).catch(() => {});
    throw new Error("SVG part callbacks must be synchronous.");
  }
}
