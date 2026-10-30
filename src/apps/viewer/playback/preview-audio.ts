import type { ViewerAppContext } from "../app/context.js";

export type TimelinePreviewAudioClip = {
  asset: any;
  duration: number;
  key: string;
  offset: number;
  start: number;
  volume: number;
};

type ActivePreviewAudio = {
  audio: HTMLAudioElement;
  url: string | null;
};

type PreviewAudioState = {
  active: Map<string, ActivePreviewAudio>;
  clipDuration?: number;
  clips?: TimelinePreviewAudioClip[];
  clipTemplate?: any;
};

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === "object");
}

function finiteNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function isAudioLayer(layer: any): boolean {
  return (
    layer?.type === "audio" ||
    layer?.kind === "audio" ||
    layer?.mediaType === "audio"
  );
}

function isAudioAsset(asset: any): boolean {
  const mimeType = String(asset?.mimeType ?? asset?.blob?.type ?? "");
  return asset?.kind === "audio" || mimeType.startsWith("audio/");
}

function getAudioAsset(ctx: ViewerAppContext, layer: any, clip: any): any {
  const assetId =
    clip?.assetId ?? layer?.assetId ?? layer?.audioAssetId ?? layer?.sourceId;
  return typeof assetId === "string" ? ctx.state.assets.get(assetId) : null;
}

function getAudioUrl(
  ctx: ViewerAppContext,
  asset: any,
): {
  url: string | null;
  revokeUrl: string | null;
} {
  if (asset?.blob instanceof Blob) {
    const url = URL.createObjectURL(asset.blob);
    return { revokeUrl: url, url };
  }
  if (typeof asset?.dataUrl === "string") {
    return { revokeUrl: null, url: asset.dataUrl };
  }
  if (typeof ctx.dataUrlToBlob === "function" && asset?.dataUrl) {
    const blob = ctx.dataUrlToBlob(
      asset.dataUrl,
      String(asset.mimeType ?? "application/octet-stream"),
    );
    const url = URL.createObjectURL(blob);
    return { revokeUrl: url, url };
  }
  return { revokeUrl: null, url: null };
}

function getClipVolume(layer: any, clip: any): number {
  const layerVolume = finiteNumber(layer?.volume, 1);
  const clipVolume = finiteNumber(clip?.volume, 1);
  return clampUnit(layerVolume * clipVolume);
}

export function collectTimelinePreviewAudioClips(
  ctx: ViewerAppContext,
  template: any,
  duration: number,
): TimelinePreviewAudioClip[] {
  const layers = Array.isArray(template?.layers) ? template.layers : [];
  const clips = Array.isArray(template?.clips) ? template.clips : [];
  const layersById = new Map<string, Record<string, any>>(
    layers
      .filter((layer) => isRecord(layer) && typeof layer.id === "string")
      .map((layer) => [layer.id, layer]),
  );
  const timelineClips =
    clips.length > 0
      ? clips
      : layers.map((layer) => ({
          duration,
          layerId: layer.id,
          offset: 0,
          start: 0,
        }));
  const audioClips: TimelinePreviewAudioClip[] = [];
  for (const clip of timelineClips) {
    if (!isRecord(clip) || clip.enabled === false || clip.disabled === true) {
      continue;
    }
    const layer =
      typeof clip.layerId === "string" ? layersById.get(clip.layerId) : null;
    if (!isAudioLayer(layer) && !isAudioLayer(clip)) {
      continue;
    }
    if (layer?.visible === false || layer?.enabled === false) {
      continue;
    }
    const asset = getAudioAsset(ctx, layer, clip);
    if (!isAudioAsset(asset)) {
      continue;
    }
    const start = Math.max(0, finiteNumber(clip.start ?? layer?.start, 0));
    const clipDuration = Math.max(
      0,
      finiteNumber(clip.duration ?? layer?.duration, duration - start),
    );
    if (start >= duration || clipDuration <= 0) {
      continue;
    }
    const layerId = String(clip.layerId ?? layer?.id ?? "audio");
    audioClips.push({
      asset,
      duration: Math.min(clipDuration, duration - start),
      key: `${layerId}:${asset.id ?? "asset"}:${start}:${clip.offset ?? 0}`,
      offset: Math.max(0, finiteNumber(clip.offset ?? layer?.offset, 0)),
      start,
      volume: getClipVolume(layer, clip),
    });
  }
  return audioClips;
}

function stopActiveAudio(item: ActivePreviewAudio): void {
  item.audio.pause();
  item.audio.removeAttribute("src");
  item.audio.load();
  if (item.url) {
    URL.revokeObjectURL(item.url);
  }
}

function seekAudio(audio: HTMLAudioElement, time: number): void {
  try {
    audio.currentTime = time;
  } catch {
    // Some browsers reject seeks before metadata is available; the next sync tick
    // will retry once the media element has buffered enough information.
  }
}

function ensurePreviewAudioState(ctx: ViewerAppContext) {
  ctx.state.previewAudio ??= { active: new Map() };
  ctx.state.previewAudio.active ??= new Map();
  return ctx.state.previewAudio as PreviewAudioState;
}

function stopPreviewAudio(ctx: ViewerAppContext): void {
  const previewAudio = ensurePreviewAudioState(ctx);
  for (const item of previewAudio.active.values()) {
    stopActiveAudio(item);
  }
  previewAudio.active.clear();
  previewAudio.clipDuration = undefined;
  previewAudio.clips = undefined;
  previewAudio.clipTemplate = undefined;
}

function syncPreviewAudio(ctx: ViewerAppContext, time: number): void {
  if (!ctx.state.playing || !ctx.state.currentTemplate) {
    stopPreviewAudio(ctx);
    return;
  }
  const template = ctx.getRenderTemplateSnapshot(ctx.state.currentTemplate);
  const duration = ctx.getEffectiveDuration(ctx.state.currentTemplate);
  const activeKeys = new Set<string>();
  const previewAudio = ensurePreviewAudioState(ctx);
  if (
    previewAudio.clipTemplate !== template ||
    previewAudio.clipDuration !== duration ||
    !previewAudio.clips
  ) {
    previewAudio.clipTemplate = template;
    previewAudio.clipDuration = duration;
    previewAudio.clips = collectTimelinePreviewAudioClips(
      ctx,
      template,
      duration,
    );
  }

  for (const clip of previewAudio.clips) {
    if (time < clip.start || time >= clip.start + clip.duration) {
      continue;
    }
    activeKeys.add(clip.key);
    const targetTime = clip.offset + time - clip.start;
    let active = previewAudio.active.get(clip.key);
    if (!active) {
      const { revokeUrl, url } = getAudioUrl(ctx, clip.asset);
      if (!url) {
        continue;
      }
      const audio = new Audio(url);
      audio.preload = "auto";
      active = { audio, url: revokeUrl };
      previewAudio.active.set(clip.key, active);
      seekAudio(audio, targetTime);
    } else if (Math.abs(active.audio.currentTime - targetTime) > 0.2) {
      seekAudio(active.audio, targetTime);
    }
    active.audio.volume = clip.volume;
    if (active.audio.paused) {
      void active.audio.play().catch(() => {
        stopActiveAudio(active);
        previewAudio.active.delete(clip.key);
      });
    }
  }

  for (const [key, active] of previewAudio.active) {
    if (!activeKeys.has(key)) {
      stopActiveAudio(active);
      previewAudio.active.delete(key);
    }
  }
}

export function installPlaybackPreviewAudioOwner(ctx: ViewerAppContext): void {
  ctx.stopPreviewAudio = stopPreviewAudio.bind(undefined, ctx);
  ctx.syncPreviewAudio = syncPreviewAudio.bind(undefined, ctx);
}
