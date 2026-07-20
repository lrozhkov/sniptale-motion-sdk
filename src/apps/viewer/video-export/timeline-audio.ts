import type { ViewerAppContext } from "../app/context.js";
import { createMp4ExportAudioContext } from "./audio.js";

export type TimelineMp4AudioClip = {
  asset: any;
  duration: number;
  offset: number;
  start: number;
  volume: number;
};

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === "object");
}

function finiteNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
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

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function getAudioAsset(ctx: ViewerAppContext, layer: any, clip: any): any {
  const assetId =
    clip?.assetId ?? layer?.assetId ?? layer?.audioAssetId ?? layer?.sourceId;
  return typeof assetId === "string" ? ctx.state.assets.get(assetId) : null;
}

function getAssetBlob(ctx: ViewerAppContext, asset: any): Blob | null {
  if (asset?.blob instanceof Blob) {
    return asset.blob;
  }
  if (typeof asset?.dataUrl === "string") {
    return ctx.dataUrlToBlob(
      asset.dataUrl,
      String(asset.mimeType ?? "application/octet-stream"),
    );
  }
  return null;
}

function getClipVolume(layer: any, clip: any): number {
  const layerVolume = finiteNumber(layer?.volume, 1);
  const clipVolume = finiteNumber(clip?.volume, 1);
  return clampUnit(layerVolume * clipVolume);
}

export function collectTimelineMp4AudioClips(
  ctx: ViewerAppContext,
  template: any,
  duration: number,
): TimelineMp4AudioClip[] {
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
  const audioClips: TimelineMp4AudioClip[] = [];
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
    audioClips.push({
      asset,
      duration: Math.min(clipDuration, duration - start),
      offset: Math.max(0, finiteNumber(clip.offset ?? layer?.offset, 0)),
      start,
      volume: getClipVolume(layer, clip),
    });
  }
  return audioClips;
}

function mixIntoChannel(
  target: Float32Array,
  source: Float32Array,
  targetStart: number,
  sourceStart: number,
  frameCount: number,
  volume = 1,
) {
  for (let frame = 0; frame < frameCount; frame += 1) {
    target[targetStart + frame] += source[sourceStart + frame] * volume;
  }
}

export async function resolveTimelineMp4AudioBuffer(
  ctx: ViewerAppContext,
  template: any,
  duration: number,
): Promise<AudioBuffer | null> {
  const audioClips = collectTimelineMp4AudioClips(ctx, template, duration);
  if (audioClips.length === 0) {
    return null;
  }
  const context = createMp4ExportAudioContext();
  try {
    const decoded = await Promise.all(
      audioClips.map(async (clip) => {
        const blob = getAssetBlob(ctx, clip.asset);
        if (!blob) {
          throw new Error(
            `Audio asset ${clip.asset?.id ?? "(unknown)"} has no data.`,
          );
        }
        return {
          audio: await context.decodeAudioData(await blob.arrayBuffer()),
          clip,
        };
      }),
    );
    const channels = Math.max(
      1,
      Math.min(
        2,
        ...decoded.map((item) => Number(item.audio.numberOfChannels) || 1),
      ),
    );
    const sampleRate = context.sampleRate;
    const outputFrames = Math.max(1, Math.ceil(duration * sampleRate));
    const output = context.createBuffer(channels, outputFrames, sampleRate);
    for (const item of decoded) {
      const targetStart = Math.max(0, Math.floor(item.clip.start * sampleRate));
      const sourceStart = Math.max(
        0,
        Math.floor(item.clip.offset * sampleRate),
      );
      const clipFrames = Math.max(
        0,
        Math.floor(item.clip.duration * sampleRate),
      );
      const frameCount = Math.min(
        clipFrames,
        item.audio.length - sourceStart,
        output.length - targetStart,
      );
      if (frameCount <= 0) {
        continue;
      }
      for (let channel = 0; channel < channels; channel += 1) {
        mixIntoChannel(
          output.getChannelData(channel),
          item.audio.getChannelData(
            Math.min(channel, item.audio.numberOfChannels - 1),
          ),
          targetStart,
          sourceStart,
          frameCount,
          item.clip.volume,
        );
      }
    }
    return output;
  } finally {
    await context.close?.();
  }
}
