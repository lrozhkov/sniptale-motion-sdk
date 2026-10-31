import { EFFECT_V1_SCHEMA } from "../../../sdk/effect-v1/index.js";
import { deepClone, normalizePresets } from "../editor/model.js";
import { stableStringify } from "./stable-json.js";

export function buildTemplateJson(template: any): string {
  return `${JSON.stringify(template, null, 2)}\n`;
}

export function buildEffectFileSource(options: {
  assets: Map<string, any> | { get(assetId: string): any };
  controlValues?: Record<string, unknown>;
  module?: any;
  template: any;
}): string {
  return `${stableStringify(buildEffectFilePayload(options))}\n`;
}

export function isEffectV1ExportableTemplate(template: any): boolean {
  return template?.effectV1?.program?.kind === "graph";
}

export function buildEffectFilePayload(options: {
  assets: Map<string, any> | { get(assetId: string): any };
  controlValues?: Record<string, unknown>;
  module?: any;
  template: any;
}): any {
  const template = options.template;
  const base = template?.effectV1;
  if (!base || typeof base !== "object") {
    throw new Error("Current item is not an Effect v1 document.");
  }
  if (base.program?.kind !== "graph") {
    throw new Error("Effect v1 requires a declarative graph program.");
  }
  return {
    assets: buildEffectFileAssets(template, options.assets),
    ...((template.controlPresets ?? base.controlPresets)
      ? {
          controlPresets: deepClone(
            template.controlPresets ?? base.controlPresets,
          ),
          defaultControlPresetId:
            template.defaultControlPresetId ?? base.defaultControlPresetId,
        }
      : {}),
    clips: deepClone(template.clips ?? []),
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
    presets: normalizePresets(template.presets ?? base.presets ?? []),
    program: deepClone(base.program),
    scenes: deepClone(template.scenes ?? base.scenes ?? []),
    schemaVersion: EFFECT_V1_SCHEMA,
    timeline: buildEffectFileTimeline(template.timeline),
  };
}

export function buildEffectFileTimeline(timeline: any): any {
  const { duration: _editorDuration, ...documentTimeline } = deepClone(
    timeline ?? { phases: [], tracks: [] },
  );
  return documentTimeline;
}

export function buildEffectFileAssets(
  template: any,
  assets: Map<string, any> | { get(assetId: string): any },
): any[] {
  return (template?.assets ?? []).map((assetId) => {
    const asset = assets.get(assetId);
    return compactObject({
      byteLength: positive(asset?.byteLength ?? asset?.blob?.size),
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

function normalizeAssetKind(asset: any): string {
  if (asset?.kind === "svg" || asset?.mimeType === "image/svg+xml")
    return "svg";
  if (asset?.kind === "audio" || String(asset?.mimeType).startsWith("audio/"))
    return "audio";
  return "image";
}

function positive(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
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
