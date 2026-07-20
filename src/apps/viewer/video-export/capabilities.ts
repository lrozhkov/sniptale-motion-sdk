import { canEncodeAudio, canEncodeVideo } from "mediabunny";
import type { AudioCodec, VideoCodec } from "mediabunny";

import {
  MP4_AUDIO_CODEC_CANDIDATES,
  MP4_VIDEO_CODEC_CANDIDATES,
  estimateVideoBitrate,
} from "./options.js";

export type Mp4CodecOption<T extends AudioCodec | VideoCodec> = {
  bitrate?: number;
  labelKey: string;
  value: T;
};

export async function getSupportedMp4VideoOptions({
  fps,
  height,
  width,
}): Promise<Array<Mp4CodecOption<VideoCodec>>> {
  const supported: Array<Mp4CodecOption<VideoCodec>> = [];
  for (const candidate of MP4_VIDEO_CODEC_CANDIDATES) {
    try {
      const bitrate = estimateVideoBitrate({
        codec: candidate.value,
        fps,
        height,
        width,
      });
      if (
        await canEncodeVideo(candidate.value, {
          bitrate,
          height,
          width,
        })
      ) {
        supported.push({ ...candidate, bitrate });
      }
    } catch {
      // Unsupported codecs are omitted from the supported-only picker.
    }
  }
  return supported;
}

export async function getSupportedMp4AudioOptions(
  audioBuffer: AudioBuffer | null,
): Promise<Array<Mp4CodecOption<AudioCodec>>> {
  if (!audioBuffer) {
    return [];
  }
  const supported: Array<Mp4CodecOption<AudioCodec>> = [];
  for (const candidate of MP4_AUDIO_CODEC_CANDIDATES) {
    try {
      if (
        await canEncodeAudio(candidate.value, {
          bitrate: candidate.bitrate,
          numberOfChannels: audioBuffer.numberOfChannels,
          sampleRate: audioBuffer.sampleRate,
        })
      ) {
        supported.push(candidate);
      }
    } catch {
      // Unsupported codecs are omitted from the supported-only picker.
    }
  }
  return supported;
}
