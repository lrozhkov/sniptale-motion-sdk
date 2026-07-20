import { serializeSvgTextVectorAsset } from "../../../shared/svg-vector-source.js";
import {
  parseSerializedSvgVector,
  type SerializedSvgVector,
} from "./svg-vector-payload.js";

const svgVectorCache = new Map<string, any>();

export function parseSvgAsset(asset: any) {
  const key = `${asset.id}:${asset.cacheKey ?? ""}:${asset.svgText?.length ?? 0}`;
  if (svgVectorCache.has(key)) return svgVectorCache.get(key);
  const serialized =
    parseSerializedSvgVector(asset.svgVector) ??
    parseSerializedSvgVector(serializeSvgTextVectorAsset(asset));
  if (!serialized) {
    throw new Error(`Failed to serialize SVG asset ${String(asset.id)}.`);
  }
  const parsed = hydrateSerializedSvgVector(serialized);
  svgVectorCache.set(key, parsed);
  return parsed;
}

export function serializeSvgVectorAsset(asset: any): SerializedSvgVector {
  const serialized =
    parseSerializedSvgVector(asset.svgVector) ??
    parseSerializedSvgVector(serializeSvgTextVectorAsset(asset));
  if (!serialized) {
    throw new Error(`Failed to serialize SVG asset ${String(asset.id)}.`);
  }
  return serialized;
}

function hydrateSerializedSvgVector(serialized: SerializedSvgVector) {
  return {
    ...serialized,
    parts: serialized.parts.map((part) =>
      part.type === "path"
        ? { ...part, path: new Path2D(part.pathData ?? "") }
        : part,
    ),
  };
}
