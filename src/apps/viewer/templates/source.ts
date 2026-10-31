import { isEditorLayer } from "../layers/source.js";
import { normalizePresets } from "../editor/model.js";
import type {
  EffectClip,
  EffectScene,
  LocaleText,
} from "../../../sdk/types.js";
import type { EditorTimeline } from "../editor/model-types.js";
import type {
  EditorControl,
  EditorPreset,
  EditorTemplate,
  EditorTemplateMetadata,
  EditorText,
} from "./model.js";

export function readTemplateSource(
  value: unknown,
): Record<string, unknown> & { id: string } {
  if (!isSource(value)) throw new Error("Invalid editor template source.");
  return value;
}

export function readTemplatePatch(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error("Invalid editor template override.");
  return value;
}

/** Inspect cloned template data; the timeline is parsed by its own owner. */
export function readEditorTemplate(
  value: unknown,
  timeline: EditorTimeline,
): EditorTemplate {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !finite(value.duration)
  ) {
    throw new Error("Invalid effective editor template.");
  }
  const layers: unknown = value.layers;
  const clips: unknown = value.clips;
  const scenes: unknown = value.scenes;
  if (
    !isMetadata(value) ||
    !isList(layers) ||
    !layers.every(isEditorLayer) ||
    !isList(clips) ||
    !clips.every(isClip) ||
    !isList(scenes) ||
    !scenes.every(isScene)
  ) {
    throw new Error("Invalid effective editor template structure.");
  }
  return {
    ...value,
    id: value.id,
    duration: value.duration,
    layers,
    clips,
    scenes,
    timeline,
  };
}

function isMetadata(
  value: Record<string, unknown>,
): value is Record<string, unknown> & EditorTemplateMetadata {
  return (
    optional(value, "assets", (list) => isList(list) && list.every(isString)) &&
    optional(
      value,
      "controls",
      (list) => isList(list) && list.every(isControl),
    ) &&
    optional(value, "presets", isList) &&
    optional(value, "label", isText) &&
    optional(value, "description", isText) &&
    ["kind", "moduleId", "effectId", "category", "target"].every((key) =>
      optional(value, key, isString),
    )
  );
}

/** Derive UI identity and controls; keep duration, timing and extensions opaque. */
export function readEditorPresets(value: unknown): EditorPreset[] {
  if (!isList(value)) return [];
  const presets: EditorPreset[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    const normalized = normalizePresets([raw])[0];
    if (!normalized) continue;
    presets.push({
      ...raw,
      id: normalized.id,
      label: isText(raw.label) ? raw.label : normalized.label,
      controls: normalized.controls,
    });
  }
  return presets;
}

function isClip(value: unknown): value is EffectClip {
  return (
    isRecord(value) &&
    typeof value.layerId === "string" &&
    finite(value.start) &&
    finite(value.duration) &&
    optional(value, "offset", finite) &&
    optional(value, "sceneId", nullableString) &&
    optional(value, "enabled", isBoolean) &&
    optional(value, "locked", isBoolean)
  );
}

function isScene(value: unknown): value is EffectScene {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    finite(value.start) &&
    finite(value.duration) &&
    optional(value, "label", (label) => label !== null && isText(label)) &&
    optional(value, "enabled", isBoolean) &&
    optional(value, "locked", isBoolean) &&
    optional(value, "transition", (entry) => entry === null || isRecord(entry))
  );
}

function isControl(value: unknown): value is EditorControl {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    Object.hasOwn(value, "defaultValue") &&
    optional(value, "kind", isString) &&
    optional(value, "label", isText) &&
    optional(value, "group", isString) &&
    ["min", "max", "step", "order"].every((key) =>
      optional(value, key, finite),
    ) &&
    optional(
      value,
      "options",
      (entries) =>
        isList(entries) &&
        entries.every(
          (entry) =>
            isRecord(entry) &&
            (typeof entry.value === "string" || finite(entry.value)) &&
            optional(entry, "label", isText),
        ),
    )
  );
}

function isSource(
  value: unknown,
): value is Record<string, unknown> & { id: string } {
  return isRecord(value) && typeof value.id === "string";
}
function isText(value: unknown): value is EditorText {
  return value === null || typeof value === "string" || isLocaleText(value);
}
function isLocaleText(value: unknown): value is LocaleText {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (entry) => entry === undefined || typeof entry === "string",
    )
  );
}
function optional(
  record: Record<string, unknown>,
  key: string,
  accepts: (value: unknown) => boolean,
): boolean {
  return !Object.hasOwn(record, key) || accepts(record[key]);
}
function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function isString(value: unknown): value is string {
  return typeof value === "string";
}
function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}
function nullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}
function isList(value: unknown): value is unknown[] {
  return Array.isArray(value);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
