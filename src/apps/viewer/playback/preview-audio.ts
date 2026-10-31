import type { ViewerAppContext } from "../app/context.js";

import type {
  ActivePreviewAudio,
  TimelinePreviewAudioClip,
} from "./audio-state.js";
export type { TimelinePreviewAudioClip } from "./audio-state.js";

type AudioAssetsContext = { state: { assets: ReadonlyMap<string, unknown> } };
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number): number {
  if (
    value !== null &&
    typeof value !== "number" &&
    typeof value !== "string" &&
    typeof value !== "boolean"
  )
    return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function isAudioLayer(layer: unknown): boolean {
  return (
    isRecord(layer) &&
    (layer?.type === "audio" ||
      layer?.kind === "audio" ||
      layer?.mediaType === "audio")
  );
}

function isAudioAsset(asset: unknown): asset is Record<string, unknown> {
  if (!isRecord(asset)) return false;
  const mimeType =
    typeof asset.mimeType === "string"
      ? asset.mimeType
      : asset.blob instanceof Blob
        ? asset.blob.type
        : "";
  return asset.kind === "audio" || mimeType.startsWith("audio/");
}

function getAudioAsset(
  ctx: AudioAssetsContext,
  layer: Record<string, unknown> | null | undefined,
  clip: Record<string, unknown>,
): unknown {
  const assetId =
    clip.assetId ?? layer?.assetId ?? layer?.audioAssetId ?? layer?.sourceId;
  return typeof assetId === "string" ? ctx.state.assets.get(assetId) : null;
}

function getAudioUrl(asset: Record<string, unknown>): {
  url: string | null;
  revokeUrl: string | null;
} {
  if (asset.blob instanceof Blob) {
    const url = URL.createObjectURL(asset.blob);
    return { revokeUrl: url, url };
  }
  return {
    revokeUrl: null,
    url: typeof asset.dataUrl === "string" ? asset.dataUrl : null,
  };
}

function getClipVolume(
  layer: Record<string, unknown> | null | undefined,
  clip: Record<string, unknown>,
): number {
  const layerVolume = finiteNumber(layer?.volume, 1);
  const clipVolume = finiteNumber(clip?.volume, 1);
  return clampUnit(layerVolume * clipVolume);
}

export function collectTimelinePreviewAudioClips(
  ctx: AudioAssetsContext,
  template: unknown,
  duration: number,
): TimelinePreviewAudioClip[] {
  if (!isRecord(template)) return [];
  const layers: unknown[] = Array.isArray(template.layers)
    ? template.layers
    : [];
  const clips: unknown[] = Array.isArray(template.clips) ? template.clips : [];
  const layersById = new Map<string, Record<string, unknown>>();
  for (const layer of layers) {
    if (isRecord(layer) && typeof layer.id === "string")
      layersById.set(layer.id, layer);
  }
  const timelineClips =
    clips.length > 0
      ? clips
      : Array.from(layersById.keys(), (id) => ({
          duration,
          layerId: id,
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
    const layerId =
      typeof clip.layerId === "string"
        ? clip.layerId
        : typeof layer?.id === "string"
          ? layer.id
          : "audio";
    const assetId = typeof asset.id === "string" ? asset.id : "asset";
    const offset = Math.max(0, finiteNumber(clip.offset ?? layer?.offset, 0));
    audioClips.push({
      asset,
      duration: Math.min(clipDuration, duration - start),
      key: `${layerId}:${assetId}:${start}:${offset}`,
      offset,
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

export function stopPreviewAudio(ctx: Pick<ViewerAppContext, "state">): void {
  const previewAudio = ctx.state.previewAudio;
  for (const item of previewAudio.active.values()) {
    stopActiveAudio(item);
  }
  previewAudio.active.clear();
  previewAudio.clipDuration = null;
  previewAudio.clips = null;
  previewAudio.clipTemplate = null;
}

export function syncPreviewAudio(
  ctx: Pick<
    ViewerAppContext,
    "state" | "getRenderTemplateSnapshot" | "getEffectiveDuration"
  >,
  time: number,
): void {
  if (!ctx.state.playing || !ctx.state.currentTemplate) {
    stopPreviewAudio(ctx);
    return;
  }
  const template = ctx.getRenderTemplateSnapshot(ctx.state.currentTemplate);
  const duration = ctx.getEffectiveDuration(ctx.state.currentTemplate);
  const activeKeys = new Set<string>();
  const previewAudio = ctx.state.previewAudio;
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
      const { revokeUrl, url } = getAudioUrl(clip.asset);
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
      const item = active;
      void item.audio.play().catch(() => {
        stopActiveAudio(item);
        if (previewAudio.active.get(clip.key) === item)
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
