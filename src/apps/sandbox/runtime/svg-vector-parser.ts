import { serializeSvgTextVectorAsset } from "../../../shared/svg-vector-source.js";
import {
  parseSerializedSvgVector,
  type SerializedSvgVector,
} from "./svg-vector-payload.js";
import { readSvgVectorAsset } from "./svg-vector-boundary.js";
import type { ParsedSvgVector } from "./svg-vector-model.js";

const svgVectorCache = new Map<
  string,
  { signature: string; parsed: ParsedSvgVector }
>();

export function parseSvgAsset(value: unknown): ParsedSvgVector {
  const asset = readSvgVectorAsset(value);
  if (!asset) throw new Error("Expected an SVG asset.");
  const supplied = parseSerializedSvgVector(asset.svgVector);
  const key = JSON.stringify([asset.id ?? null, asset.cacheKey ?? null]);
  const signature = JSON.stringify([
    asset.svgText ?? null,
    asset.width ?? null,
    asset.height ?? null,
    supplied,
  ]);
  const cached = svgVectorCache.get(key);
  if (cached?.signature === signature) return cached.parsed;
  const serialized =
    supplied ?? parseSerializedSvgVector(serializeSvgTextVectorAsset(asset));
  if (!serialized)
    throw new Error(`Failed to serialize SVG asset ${asset.id ?? "unknown"}.`);
  const parsed = hydrateSerializedSvgVector(serialized);
  svgVectorCache.set(key, { signature, parsed });
  return parsed;
}

export function serializeSvgVectorAsset(value: unknown): SerializedSvgVector {
  const asset = readSvgVectorAsset(value);
  if (!asset) throw new Error("Expected an SVG asset.");
  const serialized =
    parseSerializedSvgVector(asset.svgVector) ??
    parseSerializedSvgVector(serializeSvgTextVectorAsset(asset));
  if (!serialized)
    throw new Error(`Failed to serialize SVG asset ${asset.id ?? "unknown"}.`);
  return serialized;
}

function hydrateSerializedSvgVector(
  serialized: SerializedSvgVector,
): ParsedSvgVector {
  return {
    ...serialized,
    parts: serialized.parts.map((part) =>
      part.type === "path"
        ? { ...part, path: new Path2D(part.pathData) }
        : part,
    ),
  };
}
