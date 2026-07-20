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
  message: Record<string, any>,
  request: PreviewFrameCacheRequest,
): void {
  const duration = Math.max(0.001, Number(message.duration) || 1);
  message.frameIndex = request.frameIndex;
  message.time = request.sampleTime;
  message.progress = request.sampleTime / duration;
}

export function resolvePreviewFrameCacheRequest(
  message: Record<string, any>,
): PreviewFrameCacheRequest | null {
  if (
    message.previewCacheEnabled !== true ||
    message.previewCacheWarm !== true ||
    typeof message.renderModelId !== "string" ||
    hasInputFrames(message.inputFrames)
  ) {
    return null;
  }
  const frameIndex = Number(message.frameIndex);
  const fps = Number(message.fps);
  const duration = Number(message.duration);
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
  const contentRevision = JSON.stringify([
    String(message.effectId),
    message.renderModelId,
    typeof message.renderAssetsId === "string" ? message.renderAssetsId : "",
    controls,
    target,
  ]);
  const surfaceRevision = JSON.stringify([
    Number(message.width),
    Number(message.height),
    Number(message.outputWidth ?? message.width),
    Number(message.outputHeight ?? message.height),
    fps,
    String(message.renderQuality),
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
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const range = value as Record<string, unknown>;
  if (
    !Number.isSafeInteger(range.startFrame) ||
    Number(range.startFrame) < 0 ||
    !Number.isSafeInteger(range.endFrame) ||
    Number(range.endFrame) <= Number(range.startFrame)
  ) {
    return null;
  }
  const startFrame = Math.min(
    completeRangeEndFrame - 1,
    Number(range.startFrame),
  );
  const endFrame = Math.max(
    startFrame + 1,
    Math.min(completeRangeEndFrame, Number(range.endFrame)),
  );
  return { endFrame, startFrame };
}

function hasInputFrames(value: unknown): boolean {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    Object.values(value as Record<string, unknown>).some(Boolean)
  );
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
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
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
