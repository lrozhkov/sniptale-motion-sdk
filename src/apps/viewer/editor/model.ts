import type { LocaleText } from "../../../sdk/types.js";
import type { EditorTimeline } from "./model-types.js";
import { clamp } from "../../../sdk/protocol.js";
import { translateText } from "../../../shared/i18n/index.js";
import { normalizeMotionPaths } from "../../../shared/timeline/motion-path.js";

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function createUniquePresetId(
  presets: readonly { id: string }[],
  baseId: string,
): string {
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

export function appendCopyLabel(label: unknown): LocaleText {
  const next = normalizeLocaleText(label);
  const baseEn = next.en || next.ru || "Preset";
  const baseRu = next.ru || next.en || "Пресет";
  next.en = `${baseEn} Copy`;
  next.ru = `${baseRu} — копия`;
  return next;
}

export function normalizePresets(presets: unknown) {
  if (!Array.isArray(presets)) {
    return [];
  }
  return presets
    .filter(isRecord)
    .filter(
      (preset) => Boolean(preset.id) && primitiveText(preset.id, "") !== "",
    )
    .map((preset) => ({
      clips: deepClone(records(preset.clips)),
      controls: isRecord(preset.controls) ? deepClone(preset.controls) : {},
      duration: finiteNumber(preset.duration) || 1,
      id: primitiveText(preset.id, "preset"),
      label: isRecord(preset.label)
        ? normalizeLocaleText(preset.label)
        : { en: primitiveText(preset.id, "preset") },
      layers: deepClone(records(preset.layers)),
      scenes: normalizeScenes(
        preset.scenes ?? [],
        finiteNumber(preset.duration) || 1,
      ),
      timeline: deepClone(preset.timeline ?? { phases: [], tracks: [] }),
    }));
}

export function buildControlsWithDefaults(
  template:
    | { controls?: readonly { id: string; defaultValue: unknown }[] }
    | null
    | undefined,
  override: Record<string, unknown> = {},
): Record<string, unknown> {
  return Object.fromEntries(
    (template?.controls ?? []).map((control) => [
      control.id,
      override[control.id] ?? control.defaultValue,
    ]),
  );
}

export function normalizeScenes(scenes: unknown, duration: number) {
  const durationValue = finiteNumber(duration) || 1;
  const safeDuration = durationValue > 0 ? durationValue : 0.05;
  const normalized = Array.isArray(scenes)
    ? scenes
        .filter(isRecord)
        .map((scene, index) => ({
          duration:
            finiteNumber(scene.duration) > 0
              ? finiteNumber(scene.duration)
              : finiteNumber(scene.duration) < 0
                ? 0.05
                : safeDuration,
          enabled: scene.enabled !== false,
          id: primitiveText(scene.id, `scene-${index + 1}`),
          label: normalizeEditorLabel(
            scene.label,
            primitiveText(scene.id, `Scene ${index + 1}`),
          ),
          locked: Boolean(scene.locked),
          start: Math.max(0, finiteNumber(scene.start) || 0),
          transition: isRecord(scene.transition)
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

export function normalizeTimeline(
  value: unknown,
  duration: number,
): EditorTimeline {
  const timeline = isRecord(value) ? value : {};
  const motionPaths = normalizeMotionPaths(timeline?.motionPaths);
  const phases = Array.isArray(timeline?.phases)
    ? timeline.phases
        .filter(isRecord)
        .map((phase) => ({
          duration: Math.max(0.05, finiteNumber(phase.duration) || 0.001),
          enabled: phase.enabled !== false,
          id: primitiveText(phase.id, ""),
          label: normalizeEditorLabel(phase.label, primitiveText(phase.id, "")),
          locked: Boolean(phase.locked),
          sceneId: typeof phase.sceneId === "string" ? phase.sceneId : null,
          start: Math.max(0, finiteNumber(phase.start) || 0),
        }))
        .filter((phase) => phase.id)
    : [];
  const tracks = Array.isArray(timeline?.tracks)
    ? timeline.tracks
        .filter(isRecord)
        .map((track) => ({
          id: primitiveText(track.id, ""),
          enabled: track.enabled !== false,
          keyframes: normalizeKeyframes(track.keyframes),
          label: normalizeEditorLabel(track.label, ""),
          layerId: typeof track.layerId === "string" ? track.layerId : null,
          phaseId: typeof track.phaseId === "string" ? track.phaseId : null,
          property: primitiveText(track.property, ""),
          sceneId: typeof track.sceneId === "string" ? track.sceneId : null,
          target: primitiveText(track.target, ""),
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

export function normalizeKeyframes(keyframes: unknown) {
  if (!Array.isArray(keyframes)) {
    return [];
  }
  return keyframes
    .filter(isRecord)
    .map((keyframe, index) => ({
      easing: typeof keyframe.easing === "string" ? keyframe.easing : "linear",
      enabled: keyframe.enabled !== false,
      handles: normalizeHandles(keyframe.handles),
      id: primitiveText(keyframe.id, `k${index}`),
      phaseId: typeof keyframe.phaseId === "string" ? keyframe.phaseId : null,
      sceneId: typeof keyframe.sceneId === "string" ? keyframe.sceneId : null,
      time: Math.max(0, finiteNumber(keyframe.time) || 0),
      value: keyframe.value,
    }))
    .sort((a, b) => a.time - b.time);
}

export function normalizeHandles(value: unknown) {
  const handles = isRecord(value) ? value : {};
  return {
    x1: clamp(finiteNumber(handles.x1) || 0, 0, 1),
    x2: clamp(finiteNumber(handles.x2) || 0, 0, 1),
    y1: clamp(finiteNumber(handles.y1) || 0, 0, 1),
    y2: clamp(finiteNumber(handles.y2) || 0, 0, 1),
  };
}

function sanitizeIdentifier(value: string): string {
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
    return translateText(normalizeLocaleText(value), fallback);
  }
  return fallback;
}

function normalizeLocaleText(value: unknown): LocaleText {
  if (!isRecord(value)) return {};
  const text: LocaleText = {};
  for (const [locale, label] of Object.entries(value)) {
    if (typeof label === "string")
      Object.defineProperty(text, locale, {
        value: label,
        enumerable: true,
        configurable: true,
        writable: true,
      });
  }
  return text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function finiteNumber(value: unknown): number {
  if (
    value !== null &&
    typeof value !== "number" &&
    typeof value !== "string" &&
    typeof value !== "boolean"
  )
    return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function primitiveText(value: unknown, fallback: string): string {
  return typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
    ? String(value)
    : fallback;
}
