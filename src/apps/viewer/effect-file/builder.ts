import { readEditorTemplateSource } from "../templates/source.js";
import { EFFECT_V1_SCHEMA } from "../../../sdk/effect-v1/index.js";
import { deepClone } from "../editor/model.js";
import { stableStringify } from "./stable-json.js";

export function buildTemplateJson(template: unknown): string {
  return `${JSON.stringify(template, null, 2)}\n`;
}

export type EffectFileBuildOptions = {
  assets: { get(assetId: string): unknown };
  controlValues?: Readonly<Record<string, unknown>>;
  module?: unknown;
  template: unknown;
};

export function buildEffectFileSource(options: EffectFileBuildOptions): string {
  return `${stableStringify(buildEffectFilePayload(options))}\n`;
}

export function isEffectV1ExportableTemplate(template: unknown): boolean {
  if (!isRecord(template) || !isRecord(template.effectV1)) return false;
  return (
    isRecord(template.effectV1.program) &&
    template.effectV1.program.kind === "graph"
  );
}

export function buildEffectFilePayload(
  options: EffectFileBuildOptions,
): Record<string, unknown> {
  const source = options.template;
  if (!isRecord(source) || !isRecord(source.effectV1)) {
    throw new Error("Current item is not an Effect v1 document.");
  }
  const base = source.effectV1;
  if (!isRecord(base.program) || base.program.kind !== "graph") {
    throw new Error("Effect v1 requires a declarative graph program.");
  }
  const template = readEditorTemplateSource(source);
  return {
    assets: buildEffectFileAssets(template, options.assets),
    ...((template.controlGroups ?? base.controlGroups) !== undefined
      ? {
          controlGroups: deepClone(
            template.controlGroups ?? base.controlGroups,
          ),
        }
      : {}),
    ...((template.controlPresets ?? base.controlPresets)
      ? {
          controlPresets: deepClone(
            template.controlPresets ?? base.controlPresets,
          ),
          defaultControlPresetId:
            template.defaultControlPresetId ?? base.defaultControlPresetId,
        }
      : {}),
    clips: canonicalizeReferences(deepClone(template.clips ?? []), ["sceneId"]),
    controls: (template.controls ?? []).map((control) => ({
      ...deepClone(control),
      defaultValue: deepClone(
        options.controlValues &&
          Object.hasOwn(options.controlValues, control.id)
          ? options.controlValues[control.id]
          : control.defaultValue,
      ),
    })),
    ...((template.description ?? base.description) !== undefined
      ? { description: deepClone(template.description ?? base.description) }
      : {}),
    duration: Number(template.duration) || base.duration,
    id: template.id,
    kind: base.kind,
    label: deepClone(template.label ?? base.label),
    layers: deepClone(template.layers ?? []),
    ...(base.editorRegion
      ? { editorRegion: deepClone(base.editorRegion) }
      : {}),
    ...(base.objectLayout
      ? { objectLayout: deepClone(base.objectLayout) }
      : {}),
    presets: deepClone(template.presets ?? base.presets ?? []),
    program: deepClone(base.program),
    scenes: deepClone(template.scenes ?? base.scenes ?? []),
    schemaVersion: EFFECT_V1_SCHEMA,
    timeline: buildEffectFileTimeline(template.timeline),
  };
}

export function buildEffectFileTimeline(
  timeline: unknown,
): Record<string, unknown> {
  const source: unknown = deepClone(timeline ?? { phases: [], tracks: [] });
  if (!isRecord(source)) throw new Error("Invalid editor timeline.");
  const { duration: _editorDuration, ...documentTimeline } = source;
  return {
    ...documentTimeline,
    phases: canonicalizeReferences(documentTimeline.phases, ["sceneId"]),
    tracks: mapRecords(documentTimeline.tracks, (track) => ({
      ...omitAbsentReferences(track, [
        "layerId",
        "target",
        "phaseId",
        "sceneId",
      ]),
      keyframes: canonicalizeReferences(track.keyframes, [
        "phaseId",
        "sceneId",
      ]),
    })),
  };
}

function canonicalizeReferences(
  value: unknown,
  keys: readonly string[],
): unknown {
  return mapRecords(value, (item) => omitAbsentReferences(item, keys));
}

function mapRecords(
  value: unknown,
  convert: (item: Record<string, unknown>) => Record<string, unknown>,
): unknown {
  if (!Array.isArray(value)) return value;
  const items: unknown[] = value;
  return items.map((item) => (isRecord(item) ? convert(item) : item));
}

function omitAbsentReferences(
  value: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([key, item]) =>
        !keys.includes(key) ||
        (item !== null && item !== undefined && item !== ""),
    ),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function buildEffectFileAssets(
  template: { assets?: readonly string[] } | null,
  assets: { get(assetId: string): unknown },
): Record<string, unknown>[] {
  return (template?.assets ?? []).map((assetId) => {
    const raw = assets.get(assetId);
    const asset = isRecord(raw) ? raw : null;
    const blob = asset?.blob instanceof Blob ? asset.blob : null;
    return compactObject({
      byteLength: positive(asset?.byteLength ?? blob?.size),
      dataUrl: asset?.mimeType !== "image/svg+xml" ? asset?.dataUrl : undefined,
      duration: positive(asset?.duration),
      height: positive(asset?.height),
      id: assetId,
      kind: normalizeAssetKind(asset),
      mimeType: asset?.mimeType,
      path: asset?.path,
      sha256: asset?.sha256,
      svgText: asset?.mimeType === "image/svg+xml" ? asset?.svgText : undefined,
      width: positive(asset?.width),
    });
  });
}

function normalizeAssetKind(asset: Record<string, unknown> | null): string {
  if (asset?.kind === "svg" || asset?.mimeType === "image/svg+xml")
    return "svg";
  if (
    asset?.kind === "audio" ||
    (typeof asset?.mimeType === "string" && asset.mimeType.startsWith("audio/"))
  )
    return "audio";
  return "image";
}

function positive(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function compactObject(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, item]) => item !== undefined && item !== null,
    ),
  );
}
