import type {
  EditorTemplateSource,
  EditorTemplate,
} from "../templates/model.js";
import type { TimelineKeyframe } from "../../../sdk/types.js";
import type { PlaybackVideoCacheRange } from "./video-cache-model.js";
export type { PlaybackVideoCacheRange } from "./video-cache-model.js";
import type { ViewerAppContext } from "../app/context.js";
import { resolvePreviewCacheFrameRange } from "./cache-range.js";

type CacheTemplate = Pick<
  EditorTemplateSource,
  "id" | "moduleId" | "effectId" | "kind"
>;

const FULL_HD_PIXELS = 1920 * 1080;
const PLAYBACK_VIDEO_CACHE_KEY_VERSION = 3;

export function isPlaybackVideoCacheEligible(
  ctx: ViewerAppContext,
  template: CacheTemplate | null,
): boolean {
  const directKind =
    template?.kind === "sceneEffect" ||
    template?.kind === "transitionEffect" ||
    template?.kind === "composition";
  return Boolean(
    directKind &&
    typeof template?.effectId === "string" &&
    ctx.state.directRenderEffectIds.has(template.effectId) &&
    ctx.state.directRenderResponsePort?.presentationSurfaceAttached,
  );
}

export function shouldPreferPlaybackVideoCache(
  ctx: ViewerAppContext,
  template: CacheTemplate | null,
): boolean {
  if (template?.kind !== "composition") {
    return false;
  }
  const rasterSize = ctx.getPreviewRasterSize();
  return (
    rasterSize.width * rasterSize.height > FULL_HD_PIXELS &&
    isPlaybackVideoCacheEligible(ctx, template)
  );
}

export function createPlaybackVideoCacheKey(
  ctx: ViewerAppContext,
  template: CacheTemplate | null,
  fps: number,
  duration: number,
): string {
  const range = resolvePlaybackVideoCacheRange(ctx, duration, fps);
  const descriptor = createPlaybackVideoCacheDescriptor(
    ctx,
    template,
    fps,
    duration,
    range,
  );
  const serialized = stableSerialize(descriptor);
  return `preview-video-v${PLAYBACK_VIDEO_CACHE_KEY_VERSION}:${fingerprintCacheText(serialized)}:${serialized}`;
}

export function createPlaybackVideoCacheStorageKey(
  ctx: ViewerAppContext,
  template: CacheTemplate | null,
  fps: number,
  duration: number,
): string {
  const range = resolvePlaybackVideoCacheRange(ctx, duration, fps);
  const descriptor = {
    fps,
    keyVersion: PLAYBACK_VIDEO_CACHE_KEY_VERSION,
    moduleId: template?.moduleId ?? null,
    pack: createPackIdentity(ctx),
    previewRasterHeight: ctx.state.previewRasterHeight,
    previewRasterWidth: ctx.state.previewRasterWidth,
    range,
    templateId: template?.id ?? null,
  };
  const serialized = stableSerialize(descriptor);
  return `preview-video-storage-v${PLAYBACK_VIDEO_CACHE_KEY_VERSION}:${fingerprintCacheText(serialized)}:${serialized}`;
}

export function createPlaybackVideoCacheSegmentFingerprint(
  ctx: ViewerAppContext,
  template: CacheTemplate | null,
  fps: number,
  duration: number,
  segment: { endTime: number; startTime: number },
): string {
  const descriptor = createPlaybackVideoCacheDescriptor(
    ctx,
    template,
    fps,
    duration,
    {
      endFrame: Math.round(segment.endTime * fps),
      endTime: segment.endTime,
      startFrame: Math.round(segment.startTime * fps),
      startTime: segment.startTime,
    },
  );
  descriptor.template = createSegmentTemplateSnapshot(
    descriptor.template,
    segment.startTime,
    segment.endTime,
  );
  const serialized = stableSerialize(descriptor);
  return `${fingerprintCacheText(serialized)}:${serialized.length}`;
}

function createPlaybackVideoCacheDescriptor(
  ctx: ViewerAppContext,
  template: CacheTemplate | null,
  fps: number,
  duration: number,
  range: PlaybackVideoCacheRange,
) {
  const renderTemplate = createCanonicalRenderTemplate(
    ctx,
    ctx.getRenderTemplateSnapshot(template),
    duration,
  );
  const assetIds = renderTemplate?.assets ?? [];
  const assets = assetIds
    .map((assetId) => {
      const asset = ctx.state.assets.get(assetId);
      return {
        content: fingerprintCacheText(
          String(asset?.dataUrl ?? asset?.svgText ?? ""),
        ),
        height: asset?.height ?? null,
        id: asset?.id ?? assetId,
        mimeType: asset?.mimeType ?? null,
        name:
          asset && "name" in asset && typeof asset.name === "string"
            ? asset.name
            : null,
        path: asset?.path ?? null,
        size: asset?.blob?.size ?? 0,
        width: asset?.width ?? null,
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
  const module = template?.moduleId
    ? ctx.state.modules.get(template.moduleId)
    : undefined;
  return {
    assets,
    controls: ctx.state.controls,
    duration,
    fps,
    height: ctx.refs.canvas.height,
    keyVersion: PLAYBACK_VIDEO_CACHE_KEY_VERSION,
    module: module
      ? {
          document: fingerprintCacheText(
            JSON.stringify(module.document ?? null),
          ),
          id: module.id ?? template?.moduleId,
          path: module.path ?? null,
        }
      : null,
    pack: createPackIdentity(ctx),
    previewRasterHeight: ctx.state.previewRasterHeight,
    previewRasterWidth: ctx.state.previewRasterWidth,
    range,
    template: renderTemplate,
    width: ctx.refs.canvas.width,
  };
}

function createCanonicalRenderTemplate(
  ctx: ViewerAppContext,
  template: EditorTemplate | null,
  duration: number,
): EditorTemplate | null {
  if (
    !template ||
    typeof template !== "object" ||
    typeof ctx.deps?.normalizeTimeline !== "function"
  ) {
    return template;
  }
  return {
    ...template,
    timeline: ctx.deps.normalizeTimeline(template.timeline, duration),
  };
}

export function resolvePlaybackVideoCacheRange(
  ctx: ViewerAppContext,
  duration: number,
  fps: number,
): PlaybackVideoCacheRange {
  const normalizedDuration = Math.max(0.001, Number(duration) || 1);
  const frameRange = resolvePreviewCacheFrameRange({
    duration: normalizedDuration,
    fps,
    range: ctx.state.playbackRange,
  });
  const startTime = frameRange.startFrame / frameRange.fps;
  const endTime = Math.min(
    normalizedDuration,
    Math.max(
      startTime + 1 / frameRange.fps,
      (frameRange.endFrame - 1) / frameRange.fps,
    ),
  );
  return {
    endFrame: frameRange.endFrame,
    endTime,
    startFrame: frameRange.startFrame,
    startTime,
  };
}

function createPackIdentity(ctx: ViewerAppContext) {
  return {
    engineVersion: ctx.state.pack?.engineVersion ?? null,
    packId: ctx.state.pack?.packId ?? "local-pack",
    version: ctx.state.pack?.version ?? null,
  };
}

function createSegmentTemplateSnapshot(
  template: EditorTemplate | null,
  startTime: number,
  endTime: number,
) {
  const timeline = template?.timeline;
  if (!timeline || !Array.isArray(timeline.tracks)) {
    return template;
  }
  return {
    ...template,
    timeline: {
      ...timeline,
      tracks: timeline.tracks.map((track) => ({
        ...track,
        keyframes: selectSegmentKeyframes(track.keyframes, startTime, endTime),
      })),
    },
  };
}

function selectSegmentKeyframes(
  value: TimelineKeyframe<unknown>[],
  startTime: number,
  endTime: number,
) {
  if (!Array.isArray(value) || value.length === 0) {
    return value;
  }
  let previousIndex = -1;
  let nextIndex = -1;
  const selected = new Set<number>();
  for (let index = 0; index < value.length; index += 1) {
    const time = value[index]?.time;
    if (typeof time !== "number" || !Number.isFinite(time)) {
      return value;
    }
    if (time < startTime) {
      previousIndex = index;
    } else if (time <= endTime) {
      selected.add(index);
    } else if (nextIndex < 0) {
      nextIndex = index;
    }
  }
  if (previousIndex >= 0) selected.add(previousIndex);
  if (nextIndex >= 0) selected.add(nextIndex);
  return value.filter((_keyframe, index) => selected.has(index));
}

export function isPlaybackVideoCacheCurrent(ctx: ViewerAppContext): boolean {
  const template = ctx.state.currentTemplate;
  const cache = ctx.state.previewVideoCache;
  if (!template || !cache.key) {
    return false;
  }
  const fps = Math.max(1, Number(ctx.refs.fpsInput.value) || 30);
  return (
    cache.key ===
    createPlaybackVideoCacheKey(
      ctx,
      template,
      fps,
      ctx.getEffectiveDuration(template),
    )
  );
}

function stableSerialize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = sortValue((value as Record<string, unknown>)[key]);
      return result;
    }, {});
}

function fingerprintCacheText(value: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first ^= code;
    first = Math.imul(first, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
    second ^= second >>> 13;
  }
  return [first, second]
    .map((hash) => (hash >>> 0).toString(16).padStart(8, "0"))
    .join("");
}
