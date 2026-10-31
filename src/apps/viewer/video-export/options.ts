import type { AudioCodec, VideoCodec } from "mediabunny";

export const MP4_EXPORT_MIN_DIMENSION = 16;
export const MP4_EXPORT_MAX_PIXELS = 3840 * 2160;
export const MP4_EXPORT_MAX_FPS = 60;

export const MP4_SIZE_PRESETS = [
  { height: 720, value: "1280x720", width: 1280 },
  { height: 1080, value: "1920x1080", width: 1920 },
  { height: 1440, value: "2560x1440", width: 2560 },
  { height: 2160, value: "3840x2160", width: 3840 },
] as const;

export const MP4_VIDEO_CODEC_CANDIDATES: Array<{
  labelKey: string;
  value: VideoCodec;
}> = [
  { labelKey: "viewer.mp4Export.codecAvc", value: "avc" },
  { labelKey: "viewer.mp4Export.codecHevc", value: "hevc" },
  { labelKey: "viewer.mp4Export.codecVp9", value: "vp9" },
  { labelKey: "viewer.mp4Export.codecAv1", value: "av1" },
];

export const MP4_AUDIO_CODEC_CANDIDATES: Array<{
  bitrate: number;
  labelKey: string;
  value: AudioCodec;
}> = [
  { bitrate: 192_000, labelKey: "viewer.mp4Export.codecAac", value: "aac" },
  { bitrate: 160_000, labelKey: "viewer.mp4Export.codecOpus", value: "opus" },
];

export function clampInteger(value: unknown, min: number, max: number): number {
  const number = Math.round(readNumber(value, min) || min);
  return Math.min(max, Math.max(min, number));
}

export function normalizeEvenDimension(
  value: unknown,
  fallback: number,
): number {
  const bounded = clampInteger(
    readNumber(value, fallback),
    MP4_EXPORT_MIN_DIMENSION,
    7680,
  );
  return bounded % 2 === 0 ? bounded : bounded - 1;
}

export function normalizeExportFps(value: unknown): number {
  return clampInteger(value, 1, MP4_EXPORT_MAX_FPS);
}

export function getPresetSize(value: unknown) {
  return MP4_SIZE_PRESETS.find((preset) => preset.value === value) ?? null;
}

export function normalizeExportSize({
  height,
  sizePreset,
  width,
}: {
  height: unknown;
  sizePreset: unknown;
  width: unknown;
}) {
  const preset = getPresetSize(sizePreset);
  const nextWidth = preset?.width ?? normalizeEvenDimension(width, 1280);
  const nextHeight = preset?.height ?? normalizeEvenDimension(height, 720);
  const pixels = nextWidth * nextHeight;
  if (pixels <= MP4_EXPORT_MAX_PIXELS) {
    return { height: nextHeight, width: nextWidth };
  }
  const scale = Math.sqrt(MP4_EXPORT_MAX_PIXELS / pixels);
  return {
    height: normalizeEvenDimension(nextHeight * scale, 720),
    width: normalizeEvenDimension(nextWidth * scale, 1280),
  };
}

export function estimateVideoBitrate({
  codec = null,
  fps,
  height,
  width,
}: {
  codec?: VideoCodec | null;
  fps: number;
  height: number;
  width: number;
}) {
  const pixelsPerSecond = width * height * fps;
  if (codec === "avc") {
    // All-intra AVC needs more bits to preserve sharp UI text and dark fades.
    return clampInteger(pixelsPerSecond * 0.14, 4_000_000, 45_000_000);
  }
  return clampInteger(pixelsPerSecond * 0.08, 1_500_000, 35_000_000);
}

export function shouldEncodeExportKeyFrame({
  codec,
  fps,
  frameIndex,
}: {
  codec: VideoCodec;
  fps: number;
  frameIndex: number;
}): boolean {
  // Some hardware AVC decoders retain visible errors across predictive frames
  // in dark UI fades. Independent AVC frames trade file size for deterministic
  // playback; codecs without that compatibility issue keep a regular GOP.
  if (codec === "avc") return true;
  return frameIndex === 0 || frameIndex % (fps * 2) === 0;
}

export function createFrameTiming(duration: unknown, fps: unknown) {
  const safeDuration = Math.max(0, readNumber(duration, 0));
  const safeFps = normalizeExportFps(fps);
  const totalFrames = Math.max(1, Math.ceil(safeDuration * safeFps));
  return {
    frameDuration: 1 / safeFps,
    fps: safeFps,
    totalFrames,
  };
}

function readNumber(value: unknown, fallback: number): number {
  if (
    typeof value !== "number" &&
    typeof value !== "string" &&
    typeof value !== "boolean"
  )
    return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
