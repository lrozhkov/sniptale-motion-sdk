import type {
  EffectScene,
  TimelinePhase,
  LocaleText,
} from "../../../sdk/types.js";
import type {
  MotionPathTrack,
  TimelineMotionPath,
} from "../../../shared/timeline/motion-path.js";

export type RuntimeTimeline = {
  duration?: number;
  motionPaths?: TimelineMotionPath[];
  phases: TimelinePhase[];
  scenes?: EffectScene[];
  tracks: MotionPathTrack[];
};

import { clamp } from "./math.js";
import { normalizeMotionPaths } from "../../../shared/timeline/motion-path.js";

export function normalizeScenes(rawScenes: unknown, duration: number) {
  const safeDuration = Math.max(0.001, numericValue(duration) || 1);
  return Array.isArray(rawScenes)
    ? rawScenes
        .filter(isRecord)
        .map((scene, index) => ({
          duration: Math.max(
            0.001,
            numericValue(scene.duration) || safeDuration,
          ),
          enabled: scene.enabled !== false,
          id: identifier(scene.id, `scene-${index + 1}`),
          label: sceneLabel(scene.label ?? scene.id),
          locked: Boolean(scene.locked),
          start: Math.max(0, numericValue(scene.start) || 0),
          transition: isRecord(scene.transition) ? scene.transition : null,
        }))
        .filter((scene) => scene.id)
    : [];
}

export function resolveScene(time: number, scenes: EffectScene[]): EffectScene {
  const list = (Array.isArray(scenes) ? scenes : []).filter(
    (scene) => scene.enabled !== false,
  );
  for (const scene of list) {
    const start = numericValue(scene.start) || 0;
    const duration = numericValue(scene.duration) || 0;
    if (time >= start && time < start + duration) {
      return { ...scene, duration, start };
    }
  }
  const fallback = list[list.length - 1] ?? {
    id: "main",
    duration: 1,
    start: 0,
  };
  return {
    ...fallback,
    duration: numericValue(fallback.duration) || 1,
    start: numericValue(fallback.start) || 0,
  };
}

export function normalizeTimeline(
  rawTimeline: unknown,
  duration: number,
  scenes: EffectScene[] = [],
): RuntimeTimeline {
  if (!isRecord(rawTimeline)) {
    return { duration, phases: [], tracks: [] };
  }
  const motionPaths = normalizeMotionPaths(rawTimeline.motionPaths);
  const phases = Array.isArray(rawTimeline.phases)
    ? rawTimeline.phases
        .filter(isRecord)
        .map((phase) => ({
          duration: Math.max(0.001, numericValue(phase.duration) || 0.001),
          enabled: phase.enabled !== false,
          id: identifier(phase.id),
          label: scalarText(phase.label ?? phase.id),
          locked: Boolean(phase.locked),
          sceneId: typeof phase.sceneId === "string" ? phase.sceneId : null,
          start: clamp(numericValue(phase.start) || 0, 0, duration),
        }))
        .filter((phase) => phase.id)
    : [];
  const tracks = Array.isArray(rawTimeline.tracks)
    ? rawTimeline.tracks
        .filter(isRecord)
        .map((track) => ({
          id: identifier(track.id),
          enabled: track.enabled !== false,
          keyframes: normalizeKeyframes(track.keyframes, duration),
          label: scalarText(track.label),
          layerId: typeof track.layerId === "string" ? track.layerId : null,
          phaseId: typeof track.phaseId === "string" ? track.phaseId : null,
          property: identifier(track.property),
          sceneId: typeof track.sceneId === "string" ? track.sceneId : null,
          target: identifier(track.target),
        }))
        .filter((track) => track.id)
    : [];
  return {
    duration,
    ...(motionPaths.length > 0 ? { motionPaths } : {}),
    phases,
    scenes,
    tracks,
  };
}

export function normalizeLayers(rawLayers: unknown) {
  if (!Array.isArray(rawLayers)) {
    return [];
  }
  return rawLayers
    .filter(isRecord)
    .map((layer) => ({
      id: identifier(layer.id),
      align: typeof layer.align === "string" ? layer.align : "center",
      assetId: typeof layer.assetId === "string" ? layer.assetId : null,
      anchorX: Number.isFinite(numericValue(layer.anchorX))
        ? numericValue(layer.anchorX)
        : 0,
      anchorY: Number.isFinite(numericValue(layer.anchorY))
        ? numericValue(layer.anchorY)
        : 0,
      baseX: Number.isFinite(numericValue(layer.baseX))
        ? numericValue(layer.baseX)
        : null,
      baseY: Number.isFinite(numericValue(layer.baseY))
        ? numericValue(layer.baseY)
        : null,
      blendMode:
        typeof layer.blendMode === "string" ? layer.blendMode : "source-over",
      blur: Number.isFinite(numericValue(layer.blur))
        ? numericValue(layer.blur)
        : 0,
      color: typeof layer.color === "string" ? layer.color : "#f6fbff",
      fill:
        typeof layer.fill === "string" ? layer.fill : "rgba(255,255,255,0.12)",
      fontFamily:
        typeof layer.fontFamily === "string" ? layer.fontFamily : "Arial",
      fontSize: Number.isFinite(numericValue(layer.fontSize))
        ? numericValue(layer.fontSize)
        : 48,
      fontWeight: Number.isFinite(numericValue(layer.fontWeight))
        ? numericValue(layer.fontWeight)
        : 800,
      height: Number.isFinite(numericValue(layer.height))
        ? numericValue(layer.height)
        : 120,
      lineCap: typeof layer.lineCap === "string" ? layer.lineCap : "round",
      lineJoin: typeof layer.lineJoin === "string" ? layer.lineJoin : "round",
      locked: Boolean(layer.locked),
      name: scalarText(layer.name ?? layer.id),
      opacity: Number.isFinite(numericValue(layer.opacity))
        ? numericValue(layer.opacity)
        : 1,
      parentId: typeof layer.parentId === "string" ? layer.parentId : null,
      partBlur: Number.isFinite(numericValue(layer.partBlur))
        ? numericValue(layer.partBlur)
        : 0,
      partOrder:
        typeof layer.partOrder === "string" ? layer.partOrder : "document",
      partReveal: Number.isFinite(numericValue(layer.partReveal))
        ? numericValue(layer.partReveal)
        : 1,
      partSpread: Number.isFinite(numericValue(layer.partSpread))
        ? numericValue(layer.partSpread)
        : 0,
      partStagger: Number.isFinite(numericValue(layer.partStagger))
        ? numericValue(layer.partStagger)
        : 0,
      pathClosed: layer.pathClosed === true || layer.pathClosed === "true",
      pathPoints: normalizePathPoints(layer.pathPoints),
      radius: Number.isFinite(numericValue(layer.radius))
        ? numericValue(layer.radius)
        : 0,
      rotation: Number.isFinite(numericValue(layer.rotation))
        ? numericValue(layer.rotation)
        : 0,
      scaleX: Number.isFinite(numericValue(layer.scaleX))
        ? numericValue(layer.scaleX)
        : 1,
      scaleY: Number.isFinite(numericValue(layer.scaleY))
        ? numericValue(layer.scaleY)
        : 1,
      shadowBlur: Number.isFinite(numericValue(layer.shadowBlur))
        ? numericValue(layer.shadowBlur)
        : 0,
      shadowColor:
        typeof layer.shadowColor === "string" ? layer.shadowColor : "#ffffff",
      stroke:
        typeof layer.stroke === "string"
          ? layer.stroke
          : "rgba(255,255,255,0.72)",
      strokeWidth: Number.isFinite(numericValue(layer.strokeWidth))
        ? numericValue(layer.strokeWidth)
        : 1,
      text: typeof layer.text === "string" ? layer.text : "",
      trimEnd: Number.isFinite(numericValue(layer.trimEnd))
        ? numericValue(layer.trimEnd)
        : 1,
      trimStart: Number.isFinite(numericValue(layer.trimStart))
        ? numericValue(layer.trimStart)
        : 0,
      type: typeof layer.type === "string" ? layer.type : "customDraw",
      visible: layer.visible !== false,
      width: Number.isFinite(numericValue(layer.width))
        ? numericValue(layer.width)
        : 240,
      svgPartIds: Array.isArray(layer.svgPartIds)
        ? layer.svgPartIds.filter(
            (id: unknown): id is string => typeof id === "string",
          )
        : [],
      svgPartMode:
        typeof layer.svgPartMode === "string" ? layer.svgPartMode : "none",
      x: numericValue(layer.x) || 0,
      y: numericValue(layer.y) || 0,
    }))
    .filter((layer) => layer.id && layer.type !== "group");
}

export function normalizePathPoints(pathPoints: unknown) {
  if (!Array.isArray(pathPoints)) {
    return [];
  }
  return pathPoints
    .map((value: unknown) => {
      const point = isRecord(value) ? value : {};
      return {
        x: Math.max(-2, Math.min(2, numericValue(point?.x) || 0)),
        y: Math.max(-2, Math.min(2, numericValue(point?.y) || 0)),
      };
    })
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

export function normalizeClips(rawClips: unknown, duration: number) {
  if (!Array.isArray(rawClips)) {
    return [];
  }
  return rawClips
    .filter(isRecord)
    .map((clip) => ({
      duration: Math.max(0.001, numericValue(clip.duration) || duration),
      enabled: clip.enabled !== false,
      layerId: identifier(clip.layerId),
      locked: Boolean(clip.locked),
      offset: numericValue(clip.offset) || 0,
      sceneId: typeof clip.sceneId === "string" ? clip.sceneId : null,
      start: Math.max(0, numericValue(clip.start) || 0),
    }))
    .filter((clip) => clip.layerId);
}

export function normalizeKeyframes(rawKeyframes: unknown, duration: number) {
  if (!Array.isArray(rawKeyframes)) {
    return [];
  }
  return rawKeyframes
    .filter(isRecord)
    .map((keyframe, index) => ({
      easing: typeof keyframe.easing === "string" ? keyframe.easing : "linear",
      enabled: keyframe.enabled !== false,
      handles: normalizeHandles(keyframe.handles),
      id: identifier(keyframe.id, `k${index}`),
      phaseId: typeof keyframe.phaseId === "string" ? keyframe.phaseId : null,
      sceneId: typeof keyframe.sceneId === "string" ? keyframe.sceneId : null,
      time: clamp(numericValue(keyframe.time) || 0, 0, duration),
      value: keyframe.value,
    }))
    .sort((a, b) => a.time - b.time);
}

export function normalizeHandles(handles: unknown) {
  if (!isRecord(handles)) {
    return { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 };
  }
  return {
    x1: clamp(numericValue(handles.x1) || 0, 0, 1),
    x2: clamp(numericValue(handles.x2) || 0, 0, 1),
    y1: clamp(numericValue(handles.y1) || 0, 0, 1),
    y2: clamp(numericValue(handles.y2) || 0, 0, 1),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function identifier(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : value == null ? fallback : "";
}
function scalarText(value: unknown): string {
  return typeof value === "string"
    ? value
    : typeof value === "number" || typeof value === "boolean"
      ? String(value)
      : "";
}
function sceneLabel(value: unknown): string | LocaleText {
  if (
    isRecord(value) &&
    Object.values(value).every(
      (entry) => entry === undefined || typeof entry === "string",
    )
  ) {
    return Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  }
  return scalarText(value);
}
function numericValue(value: unknown): number {
  if (value === null) return 0;
  if (
    typeof value !== "number" &&
    typeof value !== "string" &&
    typeof value !== "boolean"
  )
    return NaN;
  const result = Number(value);
  return Number.isFinite(result) ? result : NaN;
}
