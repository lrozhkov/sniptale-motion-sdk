export const PLAYBACK_VIDEO_CACHE_SCHEMA_VERSION = 2;
export const PLAYBACK_VIDEO_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14;
export const PLAYBACK_VIDEO_CACHE_MAX_BYTES = 512 * 1024 * 1024;
export const PLAYBACK_VIDEO_CACHE_MAX_RECORDS = 12;
const PLAYBACK_VIDEO_CACHE_CODECS = new Set(["avc", "vp8", "vp9"]);
const PLAYBACK_VIDEO_CACHE_MIME_TYPES = new Set(["video/mp4", "video/webm"]);

export type PlaybackVideoCacheCodec = "avc" | "vp8" | "vp9";

export type PlaybackVideoCacheRecord = {
  accessedAt: number;
  bytes: number;
  codec: PlaybackVideoCacheCodec;
  contentKey: string;
  createdAt: number;
  duration: number;
  fps: number;
  height: number;
  key: string;
  mimeType: string;
  rangeEndFrame: number;
  rangeEndTime: number;
  rangeStartFrame: number;
  rangeStartTime: number;
  schemaVersion: number;
  segments: PlaybackVideoCacheRecordSegment[];
  templateId: string;
  width: number;
};

export type PlaybackVideoCacheRecordSegment = {
  blob: Blob;
  bytes: number;
  endFrame: number;
  endTime: number;
  fingerprint: string;
  index: number;
  startFrame: number;
  startTime: number;
};

export function normalizePlaybackVideoCacheRecord(
  value: unknown,
  expectedKey: string,
): PlaybackVideoCacheRecord | null {
  if (!isRecord(value)) {
    return null;
  }
  const rangeStartFrame = finiteInteger(value.rangeStartFrame);
  const rangeEndFrame = finiteInteger(value.rangeEndFrame);
  const rangeStartTime = finiteNumber(value.rangeStartTime);
  const rangeEndTime = finiteNumber(value.rangeEndTime);
  const fps = finiteNumber(value.fps);
  const duration = finiteNumber(value.duration);
  const width = finiteInteger(value.width);
  const height = finiteInteger(value.height);
  const segments = normalizeSegments(value.segments, value.mimeType);
  if (
    value.schemaVersion !== PLAYBACK_VIDEO_CACHE_SCHEMA_VERSION ||
    value.key !== expectedKey ||
    typeof value.codec !== "string" ||
    !PLAYBACK_VIDEO_CACHE_CODECS.has(value.codec) ||
    typeof value.contentKey !== "string" ||
    value.contentKey === "" ||
    typeof value.mimeType !== "string" ||
    !PLAYBACK_VIDEO_CACHE_MIME_TYPES.has(value.mimeType) ||
    typeof value.templateId !== "string" ||
    !Number.isFinite(value.createdAt) ||
    !Number.isFinite(value.accessedAt) ||
    rangeStartFrame === null ||
    rangeStartFrame < 0 ||
    rangeEndFrame === null ||
    rangeEndFrame <= rangeStartFrame ||
    rangeStartTime === null ||
    rangeStartTime < 0 ||
    rangeEndTime === null ||
    rangeEndTime <= rangeStartTime ||
    fps === null ||
    fps <= 0 ||
    duration === null ||
    duration <= 0 ||
    rangeEndTime > duration + 1 / fps ||
    width === null ||
    width <= 0 ||
    height === null ||
    height <= 0 ||
    !segments ||
    segments[0].startFrame !== rangeStartFrame ||
    Math.abs(segments[0].startTime - rangeStartTime) >= 0.0001 ||
    segments.at(-1)?.endFrame !== rangeEndFrame ||
    Math.abs((segments.at(-1)?.endTime ?? 0) - rangeEndTime) >= 0.0001 ||
    !codecMatchesMimeType(value.codec, value.mimeType) ||
    !segmentsAreContiguous(segments)
  ) {
    return null;
  }
  const bytes = segments.reduce((total, segment) => total + segment.bytes, 0);
  return {
    accessedAt: Number(value.accessedAt),
    bytes,
    codec: value.codec as PlaybackVideoCacheCodec,
    contentKey: value.contentKey,
    createdAt: Number(value.createdAt),
    duration,
    fps,
    height,
    key: expectedKey,
    mimeType: value.mimeType,
    rangeEndFrame,
    rangeEndTime,
    rangeStartFrame,
    rangeStartTime,
    schemaVersion: PLAYBACK_VIDEO_CACHE_SCHEMA_VERSION,
    segments,
    templateId: value.templateId,
    width,
  };
}

function codecMatchesMimeType(codec: string, mimeType: string): boolean {
  return codec === "avc" ? mimeType === "video/mp4" : mimeType === "video/webm";
}

function normalizeSegments(
  value: unknown,
  mimeType: unknown,
): PlaybackVideoCacheRecordSegment[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  const segments: PlaybackVideoCacheRecordSegment[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (!isRecord(item) || !(item.blob instanceof Blob)) {
      return null;
    }
    const startFrame = finiteInteger(item.startFrame);
    const endFrame = finiteInteger(item.endFrame);
    const startTime = finiteNumber(item.startTime);
    const endTime = finiteNumber(item.endTime);
    if (
      item.index !== index ||
      startFrame === null ||
      startFrame < 0 ||
      endFrame === null ||
      endFrame <= startFrame ||
      startTime === null ||
      startTime < 0 ||
      endTime === null ||
      endTime <= startTime ||
      typeof item.fingerprint !== "string" ||
      item.fingerprint === "" ||
      item.blob.size <= 0 ||
      (item.blob.type !== "" && item.blob.type !== mimeType)
    ) {
      return null;
    }
    segments.push({
      blob: item.blob,
      bytes: item.blob.size,
      endFrame,
      endTime,
      fingerprint: item.fingerprint,
      index,
      startFrame,
      startTime,
    });
  }
  return segments;
}

function segmentsAreContiguous(
  segments: PlaybackVideoCacheRecordSegment[],
): boolean {
  return segments.every(
    (segment, index) =>
      index === 0 ||
      (segments[index - 1].endFrame === segment.startFrame &&
        Math.abs(segments[index - 1].endTime - segment.startTime) < 0.0001),
  );
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function finiteInteger(value: unknown): number | null {
  const number = finiteNumber(value);
  return number !== null && Number.isInteger(number) ? number : null;
}
