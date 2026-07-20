import { clamp } from "../../../sdk/protocol.js";
import { translateText } from "../../../shared/i18n/index.js";
import { normalizeMotionPaths } from "../../../shared/timeline/motion-path.js";

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function createUniquePresetId(presets: any[], baseId: string): string {
  const existing = new Set((presets ?? []).map((preset) => preset.id));
  const safeBase = sanitizeIdentifier(baseId || "preset");
  let candidate = safeBase;
  let suffix = 2;
  while (existing.has(candidate)) {
    candidate = `${safeBase}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export function appendCopyLabel(label: any): any {
  const next = label && typeof label === "object" ? { ...label } : {};
  const baseEn = next.en || next.ru || "Preset";
  const baseRu = next.ru || next.en || "Пресет";
  next.en = `${baseEn} Copy`;
  next.ru = `${baseRu} — копия`;
  return next;
}

export function normalizePresets(presets: any): any[] {
  if (!Array.isArray(presets)) {
    return [];
  }
  return presets
    .filter((preset) => preset && typeof preset === "object" && preset.id)
    .map((preset) => ({
      clips: deepClone(preset.clips ?? []),
      controls:
        preset.controls && typeof preset.controls === "object"
          ? deepClone(preset.controls)
          : {},
      duration: Number(preset.duration) || 1,
      id: String(preset.id),
      label:
        preset.label && typeof preset.label === "object"
          ? deepClone(preset.label)
          : { en: String(preset.id) },
      layers: deepClone(preset.layers ?? []),
      scenes: normalizeScenes(
        preset.scenes ?? [],
        Number(preset.duration) || 1,
      ),
      timeline: deepClone(preset.timeline ?? { phases: [], tracks: [] }),
    }));
}

export function buildControlsWithDefaults(
  template: any,
  override: Record<string, unknown> = {},
): Record<string, unknown> {
  return Object.fromEntries(
    (template?.controls ?? []).map((control) => [
      control.id,
      override[control.id] ?? control.defaultValue,
    ]),
  );
}

export function normalizeScenes(scenes: any, duration: number): any[] {
  const safeDuration = Math.max(0.05, Number(duration) || 1);
  const normalized = Array.isArray(scenes)
    ? scenes
        .map((scene, index) => ({
          duration: Math.max(0.05, Number(scene.duration) || safeDuration),
          enabled: scene.enabled !== false,
          id: String(scene.id ?? `scene-${index + 1}`),
          label: normalizeEditorLabel(
            scene.label,
            String(scene.id ?? `Scene ${index + 1}`),
          ),
          locked: Boolean(scene.locked),
          start: Math.max(0, Number(scene.start) || 0),
          transition:
            scene.transition && typeof scene.transition === "object"
              ? deepClone(scene.transition)
              : null,
        }))
        .filter((scene) => scene.id)
    : [];
  return normalized.length > 0
    ? normalized
    : [
        {
          duration: safeDuration,
          id: "main",
          label: "Main",
          locked: false,
          start: 0,
          transition: null,
        },
      ];
}

export function normalizeTimeline(timeline: any, duration: number): any {
  const motionPaths = normalizeMotionPaths(timeline?.motionPaths);
  const phases = Array.isArray(timeline?.phases)
    ? timeline.phases
        .map((phase) => ({
          duration: Math.max(0.05, Number(phase.duration) || 0.001),
          enabled: phase.enabled !== false,
          id: String(phase.id ?? ""),
          label: normalizeEditorLabel(phase.label, String(phase.id ?? "")),
          locked: Boolean(phase.locked),
          sceneId: typeof phase.sceneId === "string" ? phase.sceneId : null,
          start: Math.max(0, Number(phase.start) || 0),
        }))
        .filter((phase) => phase.id)
    : [];
  const tracks = Array.isArray(timeline?.tracks)
    ? timeline.tracks
        .map((track) => ({
          id: String(track.id ?? ""),
          enabled: track.enabled !== false,
          keyframes: normalizeKeyframes(track.keyframes),
          label: normalizeEditorLabel(track.label, ""),
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
    tracks,
  };
}

export function normalizeKeyframes(keyframes: any): any[] {
  if (!Array.isArray(keyframes)) {
    return [];
  }
  return keyframes
    .map((keyframe, index) => ({
      easing: typeof keyframe.easing === "string" ? keyframe.easing : "linear",
      enabled: keyframe.enabled !== false,
      handles: normalizeHandles(keyframe.handles),
      id: String(keyframe.id ?? `k${index}`),
      phaseId: typeof keyframe.phaseId === "string" ? keyframe.phaseId : null,
      sceneId: typeof keyframe.sceneId === "string" ? keyframe.sceneId : null,
      time: Math.max(0, Number(keyframe.time) || 0),
      value: keyframe.value,
    }))
    .sort((a, b) => a.time - b.time);
}

export function normalizeHandles(handles: any): any {
  return {
    x1: clamp(Number(handles?.x1) || 0, 0, 1),
    x2: clamp(Number(handles?.x2) || 0, 0, 1),
    y1: clamp(Number(handles?.y1) || 0, 0, 1),
    y2: clamp(Number(handles?.y2) || 0, 0, 1),
  };
}

function sanitizeIdentifier(value: unknown): string {
  return (
    String(value)
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "preset"
  );
}

function normalizeEditorLabel(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return translateText(value as Record<string, string | undefined>, fallback);
  }
  return fallback;
}
