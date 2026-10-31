const MAX_CACHE_SIGNATURE_LENGTH = 16_384;
const MAX_CACHE_SIGNATURE_DEPTH = 8;
const MAX_CACHE_COLLECTION_ITEMS = 256;

export type PreviewFrameCacheRequest = {
  bindingLayerId: string | null;
  rangeEndFrame: number;
  rangeStartFrame: number;
  frameIndex: number;
  contentRevision: string;
  key: string;
  maxBindingSampleDistance: number;
  sampleTime: number;
  surfaceRevision: string;
  totalFrames: number;
};

export function applyPreviewFrameCacheSample(
  message: Record<string, unknown>,
  request: PreviewFrameCacheRequest,
): void {
  const duration = Math.max(0.001, numberValue(message.duration) || 1);
  message.frameIndex = request.frameIndex;
  message.time = request.sampleTime;
  message.progress = request.sampleTime / duration;
}

export function resolvePreviewFrameCacheRequest(
  message: Record<string, unknown>,
): PreviewFrameCacheRequest | null {
  if (
    message.previewCacheEnabled !== true ||
    message.previewCacheWarm !== true ||
    typeof message.renderModelId !== "string" ||
    typeof message.effectId !== "string" ||
    typeof message.renderQuality !== "string" ||
    (message.inputFrames !== undefined && !isRecord(message.inputFrames)) ||
    hasInputFrames(message.inputFrames)
  ) {
    return null;
  }
  const frameIndex = numberValue(message.frameIndex);
  const fps = numberValue(message.fps);
  const duration = numberValue(message.duration);
  if (
    !Number.isFinite(frameIndex) ||
    frameIndex < 0 ||
    !Number.isFinite(fps) ||
    fps <= 0 ||
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    return null;
  }
  const controls = stableSerialize(message.controls ?? {});
  const target = stableSerialize(message.target ?? null);
  if (controls === null || target === null) {
    return null;
  }
  const width = numberValue(message.width);
  const height = numberValue(message.height);
  const outputWidth = numberValue(message.outputWidth ?? message.width);
  const outputHeight = numberValue(message.outputHeight ?? message.height);
  if (
    [width, height, outputWidth, outputHeight].some(
      (size) => !Number.isFinite(size) || size <= 0,
    )
  )
    return null;
  const contentRevision = JSON.stringify([
    message.effectId,
    message.renderModelId,
    typeof message.renderAssetsId === "string" ? message.renderAssetsId : "",
    controls,
    target,
  ]);
  const surfaceRevision = JSON.stringify([
    width,
    height,
    outputWidth,
    outputHeight,
    fps,
    message.renderQuality,
  ]);
  const terminalFrameIndex = Math.max(0, Math.round(duration * fps));
  const range = resolvePreviewCacheFrameRange(
    message.previewCacheRange,
    terminalFrameIndex + 1,
  );
  if (!range) {
    return null;
  }
  const totalFrames = range.endFrame - range.startFrame;
  const roundedFrameIndex = Math.max(
    range.startFrame,
    Math.min(range.endFrame - 1, Math.round(frameIndex)),
  );
  return {
    bindingLayerId:
      typeof message.bindingLayerId === "string"
        ? message.bindingLayerId
        : null,
    contentRevision,
    frameIndex: roundedFrameIndex,
    key: `${surfaceRevision}:${roundedFrameIndex}`,
    maxBindingSampleDistance: Math.max(1, Math.ceil(fps / 12) + 1),
    rangeEndFrame: range.endFrame,
    rangeStartFrame: range.startFrame,
    sampleTime: Math.min(duration, roundedFrameIndex / fps),
    surfaceRevision,
    totalFrames,
  };
}

function resolvePreviewCacheFrameRange(
  value: unknown,
  completeRangeEndFrame: number,
): { endFrame: number; startFrame: number } | null {
  if (value === undefined) {
    return { endFrame: completeRangeEndFrame, startFrame: 0 };
  }
  if (!isRecord(value)) return null;
  const { startFrame: start, endFrame: end } = value;
  if (
    typeof start !== "number" ||
    typeof end !== "number" ||
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end <= start
  )
    return null;
  const startFrame = Math.min(completeRangeEndFrame - 1, start);
  const endFrame = Math.max(
    startFrame + 1,
    Math.min(completeRangeEndFrame, end),
  );
  return { endFrame, startFrame };
}

function hasInputFrames(value: unknown): boolean {
  return isRecord(value) && Object.values(value).some(Boolean);
}

function stableSerialize(value: unknown): string | null {
  try {
    const serialized = serializeValue(value, new Set(), 0);
    return serialized.length <= MAX_CACHE_SIGNATURE_LENGTH ? serialized : null;
  } catch {
    return null;
  }
}

function serializeValue(
  value: unknown,
  ancestors: Set<object>,
  depth: number,
): string {
  if (depth > MAX_CACHE_SIGNATURE_DEPTH) {
    throw new Error("Cache signature nesting is too deep.");
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Cache signature numbers must be finite.");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_CACHE_COLLECTION_ITEMS) {
      throw new Error("Cache signature array is too large.");
    }
    return withAncestor(
      value,
      ancestors,
      () =>
        `[${value
          .map((item) => serializeValue(item, ancestors, depth + 1))
          .join(",")}]`,
    );
  }
  if (isRecord(value)) {
    const record = value;
    const keys = Object.keys(record).sort();
    if (keys.length > MAX_CACHE_COLLECTION_ITEMS) {
      throw new Error("Cache signature object is too large.");
    }
    return withAncestor(
      value,
      ancestors,
      () =>
        `{${keys
          .map(
            (key) =>
              `${JSON.stringify(key)}:${serializeValue(record[key], ancestors, depth + 1)}`,
          )
          .join(",")}}`,
    );
  }
  throw new Error("Cache signature value is unsupported.");
}

function withAncestor(
  value: object,
  ancestors: Set<object>,
  serialize: () => string,
): string {
  if (ancestors.has(value)) {
    throw new Error("Cache signature must not be cyclic.");
  }
  ancestors.add(value);
  try {
    return serialize();
  } finally {
    ancestors.delete(value);
  }
}

function numberValue(value: unknown): number {
  return typeof value === "number" ? value : NaN;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
