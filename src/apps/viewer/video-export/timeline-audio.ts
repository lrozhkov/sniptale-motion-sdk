import { diagnosticValue } from "../../../sdk/diagnostic-value.js";
import type { ViewerAppContext } from "../app/context.js";
import { createMp4ExportAudioContext } from "./audio.js";
import {
  collectTimelineAudioClips,
  type AudioAssetsContext,
  type TimelineAudioClip,
} from "../timeline/model/audio-clips.js";

export type TimelineMp4AudioClip = Omit<TimelineAudioClip, "key">;

export function collectTimelineMp4AudioClips(
  ctx: AudioAssetsContext,
  template: unknown,
  duration: number,
): TimelineMp4AudioClip[] {
  return collectTimelineAudioClips(ctx, template, duration).map(
    ({ key: _key, ...clip }) => clip,
  );
}
function getAssetBlob(
  ctx: ViewerAppContext,
  asset: Record<string, unknown>,
): Blob | null {
  if (asset.blob instanceof Blob) return asset.blob;
  return typeof asset.dataUrl === "string"
    ? ctx.dataUrlToBlob(
        asset.dataUrl,
        typeof asset.mimeType === "string"
          ? asset.mimeType
          : "application/octet-stream",
      )
    : null;
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
    const targetIndex = targetStart + frame;
    const previous = target[targetIndex];
    const sample = source[sourceStart + frame];
    if (previous !== undefined && sample !== undefined)
      target[targetIndex] = previous + sample * volume;
  }
}

export async function resolveTimelineMp4AudioBuffer(
  ctx: ViewerAppContext,
  template: unknown,
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
            `Audio asset ${diagnosticValue(clip.asset?.id ?? "(unknown)")} has no data.`,
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
