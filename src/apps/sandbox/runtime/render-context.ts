import type { SandboxRenderFrameMessage } from "./render-message-boundary.js";
import type { PreparedRenderModel } from "./render-model-cache.js";
import type { BindingReads } from "./binding-reads.js";

type RenderCanvas = HTMLCanvasElement | OffscreenCanvas;
type CanvasFactory = (width: number, height: number) => RenderCanvas;
type CanvasRuntime = { createCanvas?: CanvasFactory };
type RenderContextMessage = Partial<SandboxRenderFrameMessage> & {
  [PREPARED_RENDER_MODEL]?: PreparedRenderModel;
};

export type SandboxRenderContext = ReturnType<typeof createRenderContext>;

import { createBindingReads, recordBindingRead } from "./binding-reads.js";
import { clamp } from "./math.js";
import {
  isLayerActive,
  normalizeClips,
  normalizeLayers,
  normalizeScenes,
  normalizeTimeline,
  resolveLayerState,
  resolvePhaseProgress,
  resolveScene,
  resolveTrackValue,
} from "./render-model.js";
import {
  resolveBindingObject,
  resolveBindingValue,
  resolveBindings,
} from "./render-bindings.js";
import { PREPARED_RENDER_MODEL } from "./render-model-cache.js";

const trackPhaseBindingCache = new WeakMap<object, Map<string, string[]>>();

export function createRenderContext(
  message: RenderContextMessage,
  renderer: { kind?: string; scenes?: unknown },
  runtime: CanvasRuntime,
  createCanvas: CanvasFactory = (width, height) => {
    if (!runtime.createCanvas)
      throw new Error("Canvas factory is unavailable.");
    return runtime.createCanvas(width, height);
  },
) {
  const preparedModel = message[PREPARED_RENDER_MODEL] ?? null;
  const duration = preparedModel?.duration ?? (Number(message.duration) || 1);
  const time = Number(message.time) || 0;
  const scenes =
    preparedModel?.scenes ??
    normalizeScenes(message.scenes ?? renderer.scenes ?? [], duration);
  const scene = resolveScene(time, scenes);
  const timeline =
    preparedModel?.timeline ??
    normalizeTimeline(message.timeline, duration, scenes);
  const layers = preparedModel?.layers ?? normalizeLayers(message.layers);
  const clips = preparedModel?.clips ?? normalizeClips(message.clips, duration);
  const trackPhaseBindings = getTrackPhaseBindings(timeline);
  const selectionOnly = message.bindingReadMode === "selection";
  const bindingLayerId =
    typeof message.bindingLayerId === "string" ? message.bindingLayerId : null;
  const bindingReads =
    selectionOnly && !bindingLayerId
      ? null
      : createBindingReads({
          dependencies: !selectionOnly,
          primitiveLayerId: selectionOnly ? bindingLayerId : null,
        });
  const inputFrames = createTrackedInputFrames(
    message.inputFrames,
    bindingReads,
  );
  const ctx = {
    __bindingReads: bindingReads,
    assets: message.assets ?? {},
    clips,
    controls: createTrackedControls(message.controls, bindingReads),
    duration,
    durationInFrames: Math.round(duration * (Number(message.fps) || 30)),
    effectId: message.effectId,
    frame: Number(message.frameIndex) || 0,
    frameIndex: Number(message.frameIndex) || 0,
    fps: Number(message.fps) || 30,
    height: Number(message.outputHeight ?? message.height) || 720,
    inputFrames,
    kind: renderer.kind,
    layers,
    progress: clamp(Number(message.progress) || 0, 0, 1),
    scene,
    sceneProgress:
      scene.duration > 0
        ? clamp((time - scene.start) / scene.duration, 0, 1)
        : 0,
    scenes,
    sceneTime: Math.max(0, time - scene.start),
    target: message.target ?? null,
    timeline,
    time,
    width: Number(message.outputWidth ?? message.width) || 1280,
    createCanvas(width?: number, height?: number): RenderCanvas {
      return createCanvas(
        width === undefined ? ctx.width : width,
        height === undefined ? ctx.height : height,
      );
    },
    bindings(definitions: unknown, at?: number): Record<string, unknown> {
      at = at === undefined ? ctx.time : at;
      return resolveBindings(ctx, definitions, at);
    },
    curve(trackId: string) {
      recordBindingRead(bindingReads, "tracks", trackId);
      return (
        timeline.tracks.find((track: { id: string }) => track.id === trackId) ??
        null
      );
    },
    phaseProgress(phaseId: string, at?: number): number {
      at = at === undefined ? ctx.time : at;
      recordBindingRead(bindingReads, "phases", phaseId);
      return resolvePhaseProgress(timeline, phaseId, at);
    },
    isLayerActive(layerId: string, at?: number): boolean {
      at = at === undefined ? ctx.time : at;
      recordBindingRead(bindingReads, "layerGateReads", layerId);
      recordBindingRead(bindingReads, "layers", layerId);
      recordBindingRead(bindingReads, "clips", layerId);
      return isLayerActive(clips, layerId, at, scenes);
    },
    renderSvg(markup: string): Promise<RenderCanvas> {
      return renderSvgToCanvas(
        markup,
        ctx.width,
        ctx.height,
        runtime,
        createCanvas,
      );
    },
    resolveLayer(
      layerId: string,
      at?: number,
    ): ReturnType<typeof resolveLayerState> {
      at = at === undefined ? ctx.time : at;
      recordBindingRead(bindingReads, "layerGateReads", layerId);
      recordBindingRead(bindingReads, "layers", layerId);
      recordBindingRead(bindingReads, "clips", layerId);
      return resolveLayerState(
        layers,
        clips,
        timeline,
        layerId,
        at,
        (trackId) =>
          recordTrackBindingRead(bindingReads, trackPhaseBindings, trackId),
      );
    },
    resolveTrack(trackId: string, fallback: unknown = 0, at?: number): unknown {
      at = at === undefined ? ctx.time : at;
      recordTrackBindingRead(bindingReads, trackPhaseBindings, trackId);
      return resolveTrackValue(timeline, trackId, at, fallback);
    },
    track(trackId: string, fallback: unknown = 0, at?: number): unknown {
      at = at === undefined ? ctx.time : at;
      recordTrackBindingRead(bindingReads, trackPhaseBindings, trackId);
      return resolveTrackValue(timeline, trackId, at, fallback);
    },
    value(definition: unknown, fallback: unknown = 0, at?: number): unknown {
      at = at === undefined ? ctx.time : at;
      return resolveBindingValue(ctx, definition, fallback, at);
    },
    values(definitions: unknown, at?: number): Record<string, unknown> {
      at = at === undefined ? ctx.time : at;
      return resolveBindingObject(ctx, definitions, at);
    },
    style(definitions: unknown, at?: number): Record<string, unknown> {
      at = at === undefined ? ctx.time : at;
      return resolveBindingObject(ctx, definitions, at);
    },
  };
  return ctx;
}

function createTrackedControls(
  controls: unknown,
  bindingReads: BindingReads | null,
): Record<string, unknown> {
  const values = isRecord(controls) ? controls : {};
  return new Proxy(values, {
    get(target, property, receiver) {
      if (typeof property === "string" && Object.hasOwn(target, property)) {
        recordBindingRead(bindingReads, "controls", property);
      }
      const value: unknown = Reflect.get(target, property, receiver);
      return value;
    },
  });
}

function recordTrackBindingRead(
  bindingReads: BindingReads | null,
  trackPhaseBindings: Map<string, string[]>,
  trackId: string,
): void {
  recordBindingRead(bindingReads, "tracks", trackId);
  for (const phaseId of trackPhaseBindings.get(trackId) ?? []) {
    recordBindingRead(bindingReads, "phases", phaseId);
  }
}

function getTrackPhaseBindings(timeline: {
  tracks?: {
    id: string;
    phaseId?: string | null;
    keyframes?: { phaseId?: string | null }[];
  }[];
}): Map<string, string[]> {
  if (!timeline || typeof timeline !== "object") {
    return new Map();
  }
  const cached = trackPhaseBindingCache.get(timeline);
  if (cached) return cached;
  const bindings = new Map<string, string[]>();
  for (const track of timeline.tracks ?? []) {
    if (typeof track?.id !== "string") continue;
    const phases = new Set<string>();
    if (typeof track.phaseId === "string") phases.add(track.phaseId);
    for (const keyframe of track.keyframes ?? []) {
      if (typeof keyframe?.phaseId === "string") phases.add(keyframe.phaseId);
    }
    bindings.set(track.id, Array.from(phases));
  }
  trackPhaseBindingCache.set(timeline, bindings);
  return bindings;
}

function createTrackedInputFrames(
  inputFrames: unknown,
  bindingReads: BindingReads | null,
) {
  const frames = isRecord(inputFrames) ? inputFrames : {};
  return {
    get from() {
      recordBindingRead(bindingReads, "inputFrames", "from");
      return frames.from;
    },
    get next() {
      recordBindingRead(bindingReads, "inputFrames", "next");
      return frames.next;
    },
    get previous() {
      recordBindingRead(bindingReads, "inputFrames", "previous");
      return frames.previous;
    },
    get source() {
      recordBindingRead(bindingReads, "inputFrames", "source");
      return frames.source;
    },
    get to() {
      recordBindingRead(bindingReads, "inputFrames", "to");
      return frames.to;
    },
  };
}

export async function renderSvgToCanvas(
  markup: string,
  width: number,
  height: number,
  runtime: CanvasRuntime,
  createCanvas: CanvasFactory = (canvasWidth, canvasHeight) => {
    if (!runtime.createCanvas)
      throw new Error("Canvas factory is unavailable.");
    return runtime.createCanvas(canvasWidth, canvasHeight);
  },
): Promise<RenderCanvas> {
  const svg = markup.trim().startsWith("<svg")
    ? markup
    : `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${markup}</svg>`;
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () =>
        reject(new Error("Failed to rasterize SVG result."));
      image.src = url;
    });
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context is unavailable.");
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
