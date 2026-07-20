import { clamp } from "./math.js";
import { normalizeMotionPaths } from "../../../shared/timeline/motion-path.js";

export function normalizeScenes(rawScenes: any, duration: number): any[] {
  const safeDuration = Math.max(0.001, Number(duration) || 1);
  return Array.isArray(rawScenes)
    ? rawScenes
        .filter((scene) => scene && typeof scene === "object")
        .map((scene, index) => ({
          duration: Math.max(0.001, Number(scene.duration) || safeDuration),
          enabled: scene.enabled !== false,
          id: String(scene.id ?? `scene-${index + 1}`),
          label: String(scene.label ?? scene.id ?? ""),
          locked: Boolean(scene.locked),
          start: Math.max(0, Number(scene.start) || 0),
          transition:
            scene.transition && typeof scene.transition === "object"
              ? scene.transition
              : null,
        }))
        .filter((scene) => scene.id)
    : [];
}

export function resolveScene(time: number, scenes: any): any {
  const list = (Array.isArray(scenes) ? scenes : []).filter(
    (scene) => scene.enabled !== false,
  );
  for (const scene of list) {
    const start = Number(scene.start) || 0;
    const duration = Number(scene.duration) || 0;
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
    duration: Number(fallback.duration) || 1,
    start: Number(fallback.start) || 0,
  };
}

export function normalizeTimeline(
  rawTimeline: any,
  duration: number,
  scenes: any[] = [],
): any {
  if (!rawTimeline || typeof rawTimeline !== "object") {
    return { duration, phases: [], tracks: [] };
  }
  const motionPaths = normalizeMotionPaths(rawTimeline.motionPaths);
  const phases = Array.isArray(rawTimeline.phases)
    ? rawTimeline.phases
        .filter((phase) => phase && typeof phase === "object")
        .map((phase) => ({
          duration: Math.max(0.001, Number(phase.duration) || 0.001),
          enabled: phase.enabled !== false,
          id: String(phase.id ?? ""),
          label: String(phase.label ?? phase.id ?? ""),
          locked: Boolean(phase.locked),
          sceneId: typeof phase.sceneId === "string" ? phase.sceneId : null,
          start: clamp(Number(phase.start) || 0, 0, duration),
        }))
        .filter((phase) => phase.id)
    : [];
  const tracks = Array.isArray(rawTimeline.tracks)
    ? rawTimeline.tracks
        .filter((track) => track && typeof track === "object")
        .map((track) => ({
          id: String(track.id ?? ""),
          enabled: track.enabled !== false,
          keyframes: normalizeKeyframes(track.keyframes, duration),
          label: String(track.label ?? ""),
          layerId: typeof track.layerId === "string" ? track.layerId : null,
          phaseId: typeof track.phaseId === "string" ? track.phaseId : null,
          property: String(track.property ?? ""),
          sceneId: typeof track.sceneId === "string" ? track.sceneId : null,
          target: String(track.target ?? ""),
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

export function normalizeLayers(rawLayers: any): any[] {
  if (!Array.isArray(rawLayers)) {
    return [];
  }
  return rawLayers
    .filter((layer) => layer && typeof layer === "object")
    .map((layer) => ({
      id: String(layer.id ?? ""),
      align: typeof layer.align === "string" ? layer.align : "center",
      assetId: typeof layer.assetId === "string" ? layer.assetId : null,
      anchorX: Number.isFinite(Number(layer.anchorX))
        ? Number(layer.anchorX)
        : 0,
      anchorY: Number.isFinite(Number(layer.anchorY))
        ? Number(layer.anchorY)
        : 0,
      baseX: Number.isFinite(Number(layer.baseX)) ? Number(layer.baseX) : null,
      baseY: Number.isFinite(Number(layer.baseY)) ? Number(layer.baseY) : null,
      blendMode:
        typeof layer.blendMode === "string" ? layer.blendMode : "source-over",
      blur: Number.isFinite(Number(layer.blur)) ? Number(layer.blur) : 0,
      color: typeof layer.color === "string" ? layer.color : "#f6fbff",
      fill:
        typeof layer.fill === "string" ? layer.fill : "rgba(255,255,255,0.12)",
      fontFamily:
        typeof layer.fontFamily === "string" ? layer.fontFamily : "Arial",
      fontSize: Number.isFinite(Number(layer.fontSize))
        ? Number(layer.fontSize)
        : 48,
      fontWeight: Number.isFinite(Number(layer.fontWeight))
        ? Number(layer.fontWeight)
        : 800,
      height: Number.isFinite(Number(layer.height))
        ? Number(layer.height)
        : 120,
      lineCap: typeof layer.lineCap === "string" ? layer.lineCap : "round",
      lineJoin: typeof layer.lineJoin === "string" ? layer.lineJoin : "round",
      locked: Boolean(layer.locked),
      name: String(layer.name ?? layer.id ?? ""),
      opacity: Number.isFinite(Number(layer.opacity))
        ? Number(layer.opacity)
        : 1,
      parentId: typeof layer.parentId === "string" ? layer.parentId : null,
      partBlur: Number.isFinite(Number(layer.partBlur))
        ? Number(layer.partBlur)
        : 0,
      partOrder:
        typeof layer.partOrder === "string" ? layer.partOrder : "document",
      partReveal: Number.isFinite(Number(layer.partReveal))
        ? Number(layer.partReveal)
        : 1,
      partSpread: Number.isFinite(Number(layer.partSpread))
        ? Number(layer.partSpread)
        : 0,
      partStagger: Number.isFinite(Number(layer.partStagger))
        ? Number(layer.partStagger)
        : 0,
      pathClosed: layer.pathClosed === true || layer.pathClosed === "true",
      pathPoints: normalizePathPoints(layer.pathPoints),
      radius: Number.isFinite(Number(layer.radius)) ? Number(layer.radius) : 0,
      rotation: Number.isFinite(Number(layer.rotation))
        ? Number(layer.rotation)
        : 0,
      scaleX: Number.isFinite(Number(layer.scaleX)) ? Number(layer.scaleX) : 1,
      scaleY: Number.isFinite(Number(layer.scaleY)) ? Number(layer.scaleY) : 1,
      shadowBlur: Number.isFinite(Number(layer.shadowBlur))
        ? Number(layer.shadowBlur)
        : 0,
      shadowColor:
        typeof layer.shadowColor === "string" ? layer.shadowColor : "#ffffff",
      stroke:
        typeof layer.stroke === "string"
          ? layer.stroke
          : "rgba(255,255,255,0.72)",
      strokeWidth: Number.isFinite(Number(layer.strokeWidth))
        ? Number(layer.strokeWidth)
        : 1,
      text: typeof layer.text === "string" ? layer.text : "",
      trimEnd: Number.isFinite(Number(layer.trimEnd))
        ? Number(layer.trimEnd)
        : 1,
      trimStart: Number.isFinite(Number(layer.trimStart))
        ? Number(layer.trimStart)
        : 0,
      type: String(layer.type ?? "customDraw"),
      visible: layer.visible !== false,
      width: Number.isFinite(Number(layer.width)) ? Number(layer.width) : 240,
      svgPartIds: typeof layer.svgPartIds === "string" ? layer.svgPartIds : "",
      svgPartMode:
        typeof layer.svgPartMode === "string" ? layer.svgPartMode : "none",
      x: Number(layer.x) || 0,
      y: Number(layer.y) || 0,
    }))
    .filter((layer) => layer.id && layer.type !== "group");
}

export function normalizePathPoints(pathPoints: any): any[] {
  if (!Array.isArray(pathPoints)) {
    return [];
  }
  return pathPoints
    .map((point) => ({
      x: Math.max(-2, Math.min(2, Number(point?.x) || 0)),
      y: Math.max(-2, Math.min(2, Number(point?.y) || 0)),
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

export function normalizeClips(rawClips: any, duration: number): any[] {
  if (!Array.isArray(rawClips)) {
    return [];
  }
  return rawClips
    .filter((clip) => clip && typeof clip === "object")
    .map((clip) => ({
      duration: Math.max(0.001, Number(clip.duration) || duration),
      enabled: clip.enabled !== false,
      layerId: String(clip.layerId ?? ""),
      locked: Boolean(clip.locked),
      offset: Number(clip.offset) || 0,
      sceneId: typeof clip.sceneId === "string" ? clip.sceneId : null,
      start: Math.max(0, Number(clip.start) || 0),
    }))
    .filter((clip) => clip.layerId);
}

export function normalizeKeyframes(rawKeyframes: any, duration: number): any[] {
  if (!Array.isArray(rawKeyframes)) {
    return [];
  }
  return rawKeyframes
    .filter((keyframe) => keyframe && typeof keyframe === "object")
    .map((keyframe, index) => ({
      easing: typeof keyframe.easing === "string" ? keyframe.easing : "linear",
      enabled: keyframe.enabled !== false,
      handles: normalizeHandles(keyframe.handles),
      id: String(keyframe.id ?? `k${index}`),
      phaseId: typeof keyframe.phaseId === "string" ? keyframe.phaseId : null,
      sceneId: typeof keyframe.sceneId === "string" ? keyframe.sceneId : null,
      time: clamp(Number(keyframe.time) || 0, 0, duration),
      value: keyframe.value,
    }))
    .sort((a, b) => a.time - b.time);
}

export function normalizeHandles(handles: any): any {
  if (!handles || typeof handles !== "object") {
    return { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 };
  }
  return {
    x1: clamp(Number(handles.x1) || 0, 0, 1),
    x2: clamp(Number(handles.x2) || 0, 0, 1),
    y1: clamp(Number(handles.y1) || 0, 0, 1),
    y2: clamp(Number(handles.y2) || 0, 0, 1),
  };
}
