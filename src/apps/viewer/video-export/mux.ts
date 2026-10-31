import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
} from "mediabunny";
import type { AudioCodec, VideoCodec } from "mediabunny";

import {
  createFrameTiming,
  estimateVideoBitrate,
  shouldEncodeExportKeyFrame,
} from "./options.js";

type EncodeMp4Args = {
  audioBitrate?: number;
  audioBuffer?: AudioBuffer | null;
  audioCodec?: AudioCodec | null;
  drawFrame: (
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    bitmap: ImageBitmap,
    progress: number,
  ) => void;
  duration: number;
  fps: number;
  height: number;
  onProgress: (frame: number, total: number) => void;
  renderFrame: (time: number, frameIndex: number) => Promise<ImageBitmap>;
  shouldCancel: () => boolean;
  videoBitrate?: number;
  videoCodec: VideoCodec;
  width: number;
};

function createExportSurface(width: number, height: number) {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    return { canvas, context: canvas.getContext("2d", { alpha: false }) };
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return { canvas, context: canvas.getContext("2d", { alpha: false }) };
}

function throwIfCanceled(shouldCancel: () => boolean) {
  if (shouldCancel()) {
    throw new DOMException("The MP4 export was canceled.", "AbortError");
  }
}

export async function encodeMp4FromRenderedFrames(
  args: EncodeMp4Args,
): Promise<Blob> {
  const { canvas, context } = createExportSurface(args.width, args.height);
  if (!context) {
    throw new Error("2D canvas context unavailable.");
  }
  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat(),
    target,
  });
  const timing = createFrameTiming(args.duration, args.fps);
  const videoSource = new CanvasSource(canvas, {
    alpha: "discard",
    bitrate:
      args.videoBitrate ??
      estimateVideoBitrate({
        codec: args.videoCodec,
        fps: timing.fps,
        height: args.height,
        width: args.width,
      }),
    codec: args.videoCodec,
    keyFrameInterval: 2,
  });
  const audioSource =
    args.audioBuffer && args.audioCodec
      ? new AudioBufferSource({
          ...(args.audioBitrate === undefined
            ? {}
            : { bitrate: args.audioBitrate }),
          codec: args.audioCodec,
        })
      : null;
  output.addVideoTrack(videoSource, { frameRate: timing.fps });
  if (audioSource) {
    output.addAudioTrack(audioSource);
  }

  try {
    await output.start();
    if (audioSource && args.audioBuffer) {
      await audioSource.add(args.audioBuffer);
    }
    for (let frameIndex = 0; frameIndex < timing.totalFrames; frameIndex += 1) {
      throwIfCanceled(args.shouldCancel);
      const time = Math.min(args.duration, frameIndex / timing.fps);
      const bitmap = await args.renderFrame(time, frameIndex);
      try {
        args.drawFrame(
          context,
          bitmap,
          args.duration > 0 ? time / args.duration : 0,
        );
      } finally {
        bitmap.close?.();
      }
      await videoSource.add(time, timing.frameDuration, {
        keyFrame: shouldEncodeExportKeyFrame({
          codec: args.videoCodec,
          fps: timing.fps,
          frameIndex,
        }),
      });
      args.onProgress(frameIndex + 1, timing.totalFrames);
    }
    throwIfCanceled(args.shouldCancel);
    await output.finalize();
  } catch (error) {
    if (output.state === "started") {
      await output.cancel().catch(() => undefined);
    }
    throw error;
  }

  if (!target.buffer) {
    throw new Error("MP4 output buffer was not finalized.");
  }
  return new Blob([target.buffer], { type: "video/mp4" });
}
