import {
  BufferTarget,
  Mp4OutputFormat,
  Output,
  VideoSample,
  VideoSampleSource,
  WebMOutputFormat,
  canEncodeVideo,
} from "mediabunny";
import type { VideoCodec } from "mediabunny";

import { estimateVideoBitrate } from "../video-export/options.js";

const PLAYBACK_CACHE_CODECS: Array<{
  codec: VideoCodec;
  createFormat: () => Mp4OutputFormat | WebMOutputFormat;
  mimeType: string;
  segmented: boolean;
}> = [
  {
    codec: "avc",
    createFormat: () =>
      new Mp4OutputFormat({
        fastStart: "fragmented",
        minimumFragmentDuration: 0.5,
      }),
    mimeType: "video/mp4",
    segmented: true,
  },
  {
    codec: "vp9",
    createFormat: () => new WebMOutputFormat(),
    mimeType: "video/webm",
    segmented: false,
  },
  {
    codec: "vp8",
    createFormat: () => new WebMOutputFormat(),
    mimeType: "video/webm",
    segmented: false,
  },
];

export type PlaybackVideoCacheEncoder = {
  addFrame(
    frame: CanvasImageSource,
    time: number,
    duration: number,
    keyFrame: boolean,
  ): Promise<void>;
  cancel(): Promise<void>;
  codec: VideoCodec;
  finalize(): Promise<Blob>;
  mimeType: string;
  segmented: boolean;
};

export async function createPlaybackVideoCacheEncoder(options: {
  fps: number;
  height: number;
  preferredCodec?: VideoCodec | null;
  width: number;
}): Promise<PlaybackVideoCacheEncoder | null> {
  const bitrate = estimateVideoBitrate(options);
  const candidate = await resolvePlaybackCacheCodec({
    bitrate,
    height: options.height,
    preferredCodec: options.preferredCodec,
    width: options.width,
  });
  if (!candidate) {
    return null;
  }
  const target = new BufferTarget();
  const output = new Output({
    format: candidate.createFormat(),
    target,
  });
  const source = new VideoSampleSource({
    bitrate,
    codec: candidate.codec,
    hardwareAcceleration: "prefer-software",
    keyFrameInterval: 2,
    latencyMode: "realtime",
  });
  output.addVideoTrack(source, { frameRate: options.fps });
  await output.start();
  return {
    addFrame: async (frame, time, duration, keyFrame) => {
      const sample = new VideoSample(frame, { duration, timestamp: time });
      try {
        await source.add(sample, { keyFrame });
      } finally {
        sample.close();
      }
    },
    cancel: async () => {
      if (output.state === "started") {
        await output.cancel().catch(() => undefined);
      }
    },
    codec: candidate.codec,
    finalize: async () => {
      await output.finalize();
      if (!target.buffer) {
        throw new Error("Playback video cache was not finalized.");
      }
      return new Blob([target.buffer], { type: candidate.mimeType });
    },
    mimeType: candidate.mimeType,
    segmented: candidate.segmented,
  };
}

async function resolvePlaybackCacheCodec(options: {
  bitrate: number;
  height: number;
  preferredCodec?: VideoCodec | null;
  width: number;
}): Promise<(typeof PLAYBACK_CACHE_CODECS)[number] | null> {
  const candidates = options.preferredCodec
    ? PLAYBACK_CACHE_CODECS.filter(
        (candidate) => candidate.codec === options.preferredCodec,
      )
    : PLAYBACK_CACHE_CODECS;
  for (const candidate of candidates) {
    try {
      if (
        await canEncodeVideo(candidate.codec, {
          bitrate: options.bitrate,
          height: options.height,
          width: options.width,
        })
      ) {
        return candidate;
      }
    } catch {
      // Unsupported encoders are skipped; live rendering remains the fallback.
    }
  }
  return null;
}
