import { bindViewerAction } from "../app/bind-action.js";
import type { AssetFileImportActions } from "./contract.js";
import { createSvgDataUrl } from "../../../shared/svg-data-url.js";
import type { ViewerAsset } from "./state.js";
import { calculateSvgRasterSize } from "../rendering/assets.js";
import type { ViewerAppContext } from "../app/context.js";

export async function rasterizeSvgAsset(
  ctx: ViewerAppContext,
  asset: ViewerAsset,
): Promise<ImageBitmap> {
  const dataUrl = createSvgDataUrl(asset.svgText ?? "");
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () =>
      reject(new Error(`Failed to load SVG asset ${asset.id}.`));
    image.src = dataUrl;
  });
  const size = calculateSvgRasterSize(asset, image);
  const canvas = ctx.createFrameBuffer(size.width, size.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("SVG Canvas 2D context is unavailable.");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return await createImageBitmap(canvas);
}

type AssetReplacementContext = {
  refs: {
    replaceAssetInput: { files: ArrayLike<File> | null; value: string };
    timelineSaveStatus: { textContent: string | null };
  };
  state: {
    currentTemplate: object | null;
    pendingAssetReplaceId: string | null;
    assets: ReadonlyMap<string, ViewerAsset>;
  };
  createAuthorAssetFromFile(
    file: File,
    options?: { assetId?: string },
  ): Promise<ViewerAsset>;
  replaceAsset(asset: ViewerAsset): void;
  logDiagnostic(message: string, level?: string): void;
};

export async function replaceSelectedAssetFile(ctx: AssetReplacementContext) {
  const file = ctx.refs.replaceAssetInput.files?.[0];
  ctx.refs.replaceAssetInput.value = "";
  const assetId = ctx.state.pendingAssetReplaceId;
  ctx.state.pendingAssetReplaceId = null;
  if (!file || !assetId) {
    return;
  }
  const source = ctx.state.currentTemplate;
  const previousAsset = ctx.state.assets.get(assetId);
  const isCurrent = () =>
    ctx.state.currentTemplate === source &&
    ctx.state.assets.get(assetId) === previousAsset;
  try {
    const asset = await ctx.createAuthorAssetFromFile(file, { assetId });
    if (!isCurrent()) return;
    ctx.replaceAsset(asset);
  } catch (error) {
    if (!isCurrent()) return;
    const message = error instanceof Error ? error.message : String(error);
    ctx.logDiagnostic(`Asset replace failed: ${message}`, "error");
    ctx.refs.timelineSaveStatus.textContent = `Asset replace failed: ${message}`;
  }
}

export async function createAuthorAssetFromFile(
  ctx: Pick<ViewerAppContext, "createAssetBitmap"> & {
    state: Pick<ViewerAppContext["state"], "assets">;
    deps: Pick<
      ViewerAppContext["deps"],
      | "normalizeAuthorAssetMimeType"
      | "SUPPORTED_AUTHOR_ASSET_TYPES"
      | "MAX_ASSET_BYTES"
      | "createUniqueAssetId"
      | "validateAuthorSvgAsset"
    >;
  },
  file: File,
  options: { assetId?: string } = {},
): Promise<ViewerAsset> {
  const mimeType = ctx.deps.normalizeAuthorAssetMimeType(file);
  if (!ctx.deps.SUPPORTED_AUTHOR_ASSET_TYPES.has(mimeType)) {
    throw new Error(
      `unsupported asset type ${mimeType || file.type || "unknown"}`,
    );
  }
  if (file.size > ctx.deps.MAX_ASSET_BYTES) {
    throw new Error(
      `asset is larger than ${(ctx.deps.MAX_ASSET_BYTES / 1000000).toFixed(1)}MB`,
    );
  }
  const id =
    options.assetId ||
    ctx.deps.createUniqueAssetId(file.name, ctx.state.assets.keys());
  if (mimeType === "image/svg+xml") {
    const svgText = await file.text();
    ctx.deps.validateAuthorSvgAsset(svgText, file.name);
    const blob = new Blob([svgText], { type: mimeType });
    const asset: ViewerAsset = {
      blob,
      height: null,
      id,
      kind: "svg",
      mimeType,
      path: file.name,
      svgText,
      width: null,
    };
    const bitmap = await ctx.createAssetBitmap(asset);
    asset.width = bitmap.width;
    asset.height = bitmap.height;
    bitmap.close?.();
    return asset;
  }
  const bitmap = await createImageBitmap(file);
  try {
    return {
      blob: file,
      dataUrl: await fileToDataUrl(file),
      height: bitmap.height,
      id,
      kind: "image",
      mimeType,
      path: file.name,
      svgText: null,
      width: bitmap.width,
    };
  } finally {
    bitmap.close();
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result: unknown = reader.result;
      if (typeof result === "string") resolve(result);
      else reject(new Error(`failed to read ${file.name}`));
    };
    reader.onabort = () => reject(new Error(`failed to read ${file.name}`));
    reader.onerror = () => reject(new Error(`failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function dataUrlToBlob(
  _ctx: ViewerAppContext,
  dataUrl: string,
  fallbackMimeType = "application/octet-stream",
) {
  const [header, base64 = ""] = dataUrl.split(",");
  const mimeMatch = /^data:([^;]+);base64$/i.exec(header ?? "");
  const mimeType = mimeMatch?.[1] ?? fallbackMimeType;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

export function createAssetFileImportActions(
  getContext: () => ViewerAppContext,
): AssetFileImportActions {
  return {
    createAuthorAssetFromFile: bindViewerAction(
      createAuthorAssetFromFile,
      getContext,
    ),
    replaceSelectedAssetFile: bindViewerAction(
      replaceSelectedAssetFile,
      getContext,
    ),
  };
}
