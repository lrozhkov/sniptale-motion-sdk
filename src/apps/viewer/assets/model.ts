import type { ViewerAsset } from "./state.js";
import type { AssetLayerPlacement, CreatedAssetLayer } from "./contract.js";
import { createSvgDataUrl } from "../../../shared/svg-data-url.js";
import { isSafeSvgText } from "../../../sdk/svg-safety.js";
import { SUPPORTED_AUTHOR_ASSET_TYPES } from "../app/constants.js";

export function normalizeAuthorAssetMimeType(file: {
  name?: string;
  type?: string;
}): string {
  if (file.type !== undefined && SUPPORTED_AUTHOR_ASSET_TYPES.has(file.type)) {
    return file.type;
  }
  const name = String(file.name ?? "").toLowerCase();
  if (name.endsWith(".svg")) return "image/svg+xml";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".webp")) return "image/webp";
  return file.type || "application/octet-stream";
}

export function validateAuthorSvgAsset(
  svgText: unknown,
  sourceName = "asset.svg",
): void {
  if (!isSafeSvgAssetText(svgText)) {
    throw new Error(`${sourceName} is not valid SVG text`);
  }
}

export function isSafeSvgAssetText(svgText: unknown): boolean {
  return isSafeSvgText(svgText);
}

export function getAssetUsageCount(
  template: { layers?: readonly Record<string, unknown>[] } | null | undefined,
  assetId: string,
): number {
  return getAssetUsageLayers(template, assetId).length;
}

export function getAssetUsageLayers<Layer extends Record<string, unknown>>(
  template: { layers?: readonly Layer[] } | null | undefined,
  assetId: string,
): Layer[] {
  return (template?.layers ?? []).filter((layer) => layer.assetId === assetId);
}

export function getAssetPreviewUrl(asset: ViewerAsset): string | null {
  if (asset.mimeType === "image/svg+xml" && asset.svgText) {
    return createSvgDataUrl(asset.svgText);
  }
  return asset.dataUrl || null;
}

export function formatAssetMeta(asset: ViewerAsset): string {
  const size =
    asset.width && asset.height
      ? `${Math.round(asset.width)} x ${Math.round(asset.height)}`
      : "unknown size";
  return `${asset.mimeType || asset.kind || "asset"} · ${size} · ${
    asset.path || asset.id
  }`;
}

export function createAssetLayer(
  asset: ViewerAsset,
  template: { layers?: readonly { id: string; type?: string }[] },
  options: AssetLayerPlacement = {},
): CreatedAssetLayer {
  const kind = asset.mimeType === "image/svg+xml" ? "svgAsset" : "imageAsset";
  const id = createUniqueLayerId(
    kind === "svgAsset" ? "svg-asset" : "image-asset",
    template.layers ?? [],
  );
  const assetLayerCount = (template.layers ?? []).filter(
    (layer) => layer.type === "svgAsset" || layer.type === "imageAsset",
  ).length;
  const sourceWidth = Math.max(1, Number(asset.width) || 512);
  const sourceHeight = Math.max(1, Number(asset.height) || 512);
  const scale = Math.min(1, 280 / Math.max(sourceWidth, sourceHeight));
  const dropped = options.canvasPoint
    ? {
        x: options.canvasPoint.x - Number(options.canvasWidth || 0) * 0.5,
        y: options.canvasPoint.y - Number(options.canvasHeight || 0) * 0.5,
      }
    : null;
  return {
    assetId: asset.id,
    blendMode: "source-over",
    blur: 0,
    height: Math.max(24, Math.round(sourceHeight * scale)),
    id,
    locked: false,
    name: asset.path ? `Asset ${asset.path}` : "Asset Layer",
    opacity: 1,
    parentId: null,
    anchorX: 0,
    anchorY: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    ...(kind === "svgAsset"
      ? {
          partBlur: 2.4,
          partOrder: "document",
          partReveal: 1,
          partSpread: 0,
          partStagger: 0.08,
          svgPartIds: [],
          svgPartMode: "none",
        }
      : {}),
    type: kind,
    visible: true,
    width: Math.max(24, Math.round(sourceWidth * scale)),
    x: dropped?.x ?? assetLayerCount * 52,
    y: dropped?.y ?? -220 + assetLayerCount * 48,
  };
}

export function withAssetLayerTypeDefaults<
  Layer extends Record<string, unknown>,
>(layer: Layer, type: string) {
  if (type !== "svgAsset") {
    const {
      partBlur: _partBlur,
      partOrder: _partOrder,
      partReveal: _partReveal,
      partSpread: _partSpread,
      partStagger: _partStagger,
      svgPartIds: _svgPartIds,
      svgPartMode: _svgPartMode,
      ...rest
    } = layer;
    return rest;
  }
  return {
    partBlur: 2.4,
    partOrder: "document",
    partReveal: 1,
    partSpread: 0,
    partStagger: 0.08,
    svgPartIds: [],
    svgPartMode: "none",
    ...layer,
  };
}

export function createUniqueAssetId(
  sourceName: unknown,
  existingAssetIds: Iterable<string>,
): string {
  const baseName = primitiveText(sourceName, "asset").replace(/\.[^.]+$/, "");
  const base = `asset-${sanitizeIdentifier(baseName)}`;
  const ids = new Set(existingAssetIds);
  let candidate = base;
  let suffix = 2;
  while (ids.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function createUniqueLayerId(
  kind: string,
  layers: readonly { id: string }[],
): string {
  const ids = new Set(layers.map((layer) => layer.id));
  let index = 1;
  let id = `${kind}-${index}`;
  while (ids.has(id)) {
    index += 1;
    id = `${kind}-${index}`;
  }
  return id;
}

function sanitizeIdentifier(value: unknown): string {
  return (
    primitiveText(value, "")
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "asset"
  );
}

function primitiveText(value: unknown, fallback: string): string {
  return value &&
    (typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean")
    ? String(value)
    : fallback;
}
