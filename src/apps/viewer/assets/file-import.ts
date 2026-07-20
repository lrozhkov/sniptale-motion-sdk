import type { ViewerAppContext } from "../app/context.js";

async function rasterizeSvgAsset(ctx: ViewerAppContext, asset) {
  const dataUrl = `data:image/svg+xml;base64,${btoa(asset.svgText ?? "")}`;
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () =>
      reject(new Error(`Failed to load SVG asset ${asset.id}.`));
    image.src = dataUrl;
  });
  const size = ctx.getSvgRasterSize(asset, image);
  const canvas = ctx.createFrameBuffer(size.width, size.height);
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return await createImageBitmap(canvas);
}

async function replaceSelectedAssetFile(ctx: ViewerAppContext) {
  const file = ctx.refs.replaceAssetInput.files?.[0];
  ctx.refs.replaceAssetInput.value = "";
  const assetId = ctx.state.pendingAssetReplaceId;
  ctx.state.pendingAssetReplaceId = null;
  if (!file || !assetId) {
    return;
  }
  try {
    const asset = await ctx.createAuthorAssetFromFile(file, { assetId });
    ctx.replaceAsset(asset);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.logDiagnostic(`Asset replace failed: ${message}`, "error");
    ctx.refs.timelineSaveStatus.textContent = `Asset replace failed: ${message}`;
  }
}

async function createAuthorAssetFromFile(
  ctx: ViewerAppContext,
  file,
  options: any = {},
) {
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
    const asset = {
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
  const asset = {
    blob: file,
    dataUrl: await ctx.fileToDataUrl(file),
    height: bitmap.height,
    id,
    kind: "image",
    mimeType,
    path: file.name,
    svgText: null,
    width: bitmap.width,
  };
  bitmap.close?.();
  return asset;
}

function fileToDataUrl(ctx: ViewerAppContext, file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error(`failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function dataUrlToBlob(
  ctx: ViewerAppContext,
  dataUrl,
  fallbackMimeType = "application/octet-stream",
) {
  const [header, base64 = ""] = String(dataUrl).split(",");
  const mimeMatch = /^data:([^;]+);base64$/i.exec(header);
  const mimeType = mimeMatch?.[1] ?? fallbackMimeType;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

export function installAssetsFileImportOwner(ctx: ViewerAppContext): void {
  ctx.rasterizeSvgAsset = (...args: any[]) =>
    (rasterizeSvgAsset as any)(ctx, ...args);
  ctx.replaceSelectedAssetFile = (...args: any[]) =>
    (replaceSelectedAssetFile as any)(ctx, ...args);
  ctx.createAuthorAssetFromFile = (...args: any[]) =>
    (createAuthorAssetFromFile as any)(ctx, ...args);
  ctx.fileToDataUrl = (...args: any[]) => (fileToDataUrl as any)(ctx, ...args);
  ctx.dataUrlToBlob = (...args: any[]) => (dataUrlToBlob as any)(ctx, ...args);
}
