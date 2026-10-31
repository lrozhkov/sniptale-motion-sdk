import { readViewerAsset, type ViewerAsset } from "./state.js";
import type { ViewerAppContext } from "../app/context.js";

function addAssetLayer(
  ctx: ViewerAppContext,
  asset: ViewerAsset,
  options: { canvasPoint?: { x: number; y: number } } = {},
) {
  const source = ctx.state.currentTemplate;
  if (!source) return;
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  if (!template) {
    return;
  }
  ctx.applyEditorCommand(
    { payload: { assetId: asset.id, path: asset.path }, type: "addLayer" },
    () => {
      ctx.state.assets.set(asset.id, asset);
      const layer = ctx.deps.createAssetLayer(asset, template, {
        ...options,
        canvasHeight: ctx.refs.canvas.height,
        canvasWidth: ctx.refs.canvas.width,
      });
      const existingAssets = Array.isArray(template.assets)
        ? template.assets
        : [];
      const assets = existingAssets.includes(asset.id)
        ? existingAssets
        : [...existingAssets, asset.id];
      const layers = [...ctx.deps.deepClone(template.layers ?? []), layer];
      const clips = [
        ...ctx.deps.deepClone(template.clips ?? []),
        {
          duration: template.duration,
          layerId: layer.id,
          locked: false,
          offset: 0,
          start: 0,
        },
      ];
      const timeline = ctx.getEffectiveTimeline(ctx.state.currentTemplate);
      ctx.upsertTrackKeyframe(timeline, layer.id, "opacity", layer.opacity, 0);
      ctx.upsertTrackKeyframe(timeline, layer.id, "x", layer.x, 0);
      ctx.upsertTrackKeyframe(timeline, layer.id, "y", layer.y, 0);
      ctx.setEditorOverride({ assets, clips, layers });
      ctx.state.timelineOverrides.set(
        source.id,
        ctx.deps.normalizeTimeline(timeline, template.duration),
      );
      ctx.selectLayer(layer.id);
      ctx.refs.timelineSaveStatus.textContent = `Imported ${asset.path}`;
      ctx.logDiagnostic(`Imported ${asset.path} as ${layer.name}.`, "ok");
      ctx.renderTimelineEditor(ctx.state.currentTemplate);
      ctx.renderAssetsPanel(ctx.state.currentTemplate);
      void ctx.renderCurrentFrame();
      return layer;
    },
  );
}

function replaceAsset(ctx: ViewerAppContext, asset: ViewerAsset) {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  if (!template) {
    return;
  }
  ctx.applyEditorCommand(
    {
      payload: { assetId: asset.id, path: asset.path },
      type: "replaceAsset",
    },
    () => {
      ctx.state.assets.set(asset.id, asset);
      const assets =
        Array.isArray(template.assets) && template.assets.includes(asset.id)
          ? ctx.deps.deepClone(template.assets)
          : [...(template.assets ?? []), asset.id];
      const nextType =
        asset.mimeType === "image/svg+xml" ? "svgAsset" : "imageAsset";
      const layers = ctx.deps
        .deepClone(template.layers ?? [])
        .map((layer) =>
          layer.assetId === asset.id &&
          (layer.type === "svgAsset" || layer.type === "imageAsset")
            ? ctx.deps.withAssetLayerTypeDefaults(
                { ...layer, type: nextType },
                nextType,
              )
            : layer,
        );
      ctx.setEditorOverride({ assets, layers });
      ctx.refs.timelineSaveStatus.textContent = `Replaced ${asset.id}`;
      ctx.logDiagnostic(`Replaced asset ${asset.id} with ${asset.path}.`, "ok");
      ctx.renderAssetsPanel(ctx.state.currentTemplate);
      ctx.renderTimelineEditor(ctx.state.currentTemplate);
      void ctx.renderCurrentFrame();
    },
  );
}

export function prepareImportedAssets(
  ctx: { dataUrlToBlob(dataUrl: string, mimeType: string): Blob },
  assets: unknown,
): Map<string, ViewerAsset> {
  if (!Array.isArray(assets))
    throw new Error("Imported assets must be an array.");
  const prepared = new Map<string, ViewerAsset>();
  for (const value of assets) {
    const asset = readViewerAsset(value);
    if (!asset) {
      throw new Error("Imported asset has invalid metadata.");
    }
    if (prepared.has(asset.id))
      throw new Error(`Duplicate imported asset "${asset.id}".`);
    const mimeType =
      typeof asset.mimeType === "string"
        ? asset.mimeType
        : "application/octet-stream";
    const blob =
      asset.svgText && mimeType === "image/svg+xml"
        ? new Blob([asset.svgText], { type: mimeType })
        : typeof asset.dataUrl === "string"
          ? ctx.dataUrlToBlob(asset.dataUrl, mimeType)
          : null;
    if (!blob) {
      throw new Error(
        `Asset "${asset.id}" has no materialized content. Select its referenced file together with the Effect document.`,
      );
    }
    const registeredAsset: ViewerAsset = {
      blob,
      byteLength: asset.byteLength ?? blob.size,
      dataUrl: typeof asset.dataUrl === "string" ? asset.dataUrl : null,
      height: asset.height ?? null,
      id: asset.id,
      kind: typeof asset.kind === "string" ? asset.kind : null,
      mimeType,
      path: typeof asset.path === "string" ? asset.path : null,
      sha256: typeof asset.sha256 === "string" ? asset.sha256 : null,
      svgText: typeof asset.svgText === "string" ? asset.svgText : null,
      width: asset.width ?? null,
    };
    prepared.set(asset.id, registeredAsset);
  }
  return prepared;
}

export async function verifyImportedAssets(
  ctx: ViewerAppContext,
  assets: ReadonlyMap<string, ViewerAsset>,
): Promise<void> {
  for (const asset of assets.values()) {
    try {
      if (asset.kind === "image" || asset.kind === "svg") {
        const bitmap = await ctx.createAssetBitmap(asset);
        bitmap.close();
      } else if (asset.kind === "audio") {
        if (!asset.blob) throw new Error("Audio content is missing.");
        await verifyMediaBlob(asset.blob);
      }
    } catch {
      throw new Error(
        `Asset "${asset.id}" could not be decoded as ${asset.mimeType}.`,
      );
    }
  }
}

async function verifyMediaBlob(blob: Blob): Promise<void> {
  const element = document.createElement("audio");
  const url = URL.createObjectURL(blob);
  try {
    element.preload = "metadata";
    element.src = url;
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => finish(false), 5000);
      const finish = (ok: boolean) => {
        window.clearTimeout(timeout);
        element.removeEventListener("loadedmetadata", onReady);
        element.removeEventListener("error", onError);
        ok ? resolve() : reject(new Error("Media decode failed."));
      };
      const onReady = () => finish(true);
      const onError = () => finish(false);
      element.addEventListener("loadedmetadata", onReady, { once: true });
      element.addEventListener("error", onError, { once: true });
      element.load();
    });
  } finally {
    element.removeAttribute("src");
    element.load();
    URL.revokeObjectURL(url);
  }
}

export function installAssetsLayerBindingOwner(ctx: ViewerAppContext): void {
  ctx.addAssetLayer = addAssetLayer.bind(undefined, ctx);
  ctx.replaceAsset = replaceAsset.bind(undefined, ctx);
  ctx.prepareImportedAssets = prepareImportedAssets.bind(undefined, ctx);
  ctx.verifyImportedAssets = verifyImportedAssets.bind(undefined, ctx);
}
