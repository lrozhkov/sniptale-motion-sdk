// Registry metadata is distinct from decoded browser resources.
export type ViewerAsset = {
  id: string;
  blob?: Blob | undefined;
  byteLength?: number | undefined;
  dataUrl?: string | null | undefined;
  height?: number | null | undefined;
  width?: number | null | undefined;
  kind?: string | null | undefined;
  mimeType?: string | undefined;
  path?: string | null | undefined;
  sha256?: string | null | undefined;
  svgText?: string | null | undefined;
};

export type RenderAssetSelection = {
  assetIds: string[];
  assetSources: Array<ViewerAsset | null>;
  id: string;
  routeId: string;
};

function isViewerAsset(value: unknown): value is ViewerAsset {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const asset = value as Record<string, unknown>;
  if (typeof asset.id !== "string" || !asset.id) return false;
  for (const key of ["dataUrl", "kind", "path", "sha256", "svgText"]) {
    if (asset[key] != null && typeof asset[key] !== "string") return false;
  }
  if (asset.mimeType !== undefined && typeof asset.mimeType !== "string")
    return false;
  for (const key of ["width", "height"]) {
    const number = asset[key];
    if (
      number != null &&
      (typeof number !== "number" || !Number.isFinite(number) || number < 0)
    )
      return false;
  }
  if (
    asset.byteLength !== undefined &&
    (typeof asset.byteLength !== "number" ||
      !Number.isFinite(asset.byteLength) ||
      asset.byteLength < 0)
  )
    return false;
  if (asset.blob !== undefined && !(asset.blob instanceof Blob)) return false;
  return true;
}

export function readViewerAsset(value: unknown): ViewerAsset | null {
  return isViewerAsset(value) ? value : null;
}

export function createViewerAssetState(): {
  assets: Map<string, ViewerAsset>;
  baseAssets: Map<string, ViewerAsset>;
  renderAssetSelection: RenderAssetSelection | null;
} {
  return {
    assets: new Map(),
    baseAssets: new Map(),
    renderAssetSelection: null,
  };
}
