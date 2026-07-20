import { normalizeEffectV1ToTemplate } from "../../../sdk/effect-v1/index.js";
import type { NormalizeEffectFileOptions } from "./validation-types.js";

export function normalizeEffectFilePayload(
  payload: any,
  errors: string[] = [],
  options: NormalizeEffectFileOptions = {},
): any {
  if (!payload || typeof payload !== "object") {
    errors.push("Effect file payload must be an object");
    return null;
  }
  const normalizePresets = options.normalizePresets ?? defaultNormalizeArray;
  const template = normalizeEffectV1ToTemplate(payload);
  template.presets = normalizePresets(payload.presets ?? []);
  return {
    assets: Array.isArray(payload.assets) ? payload.assets : [],
    document: payload,
    template,
  };
}

function defaultNormalizeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
