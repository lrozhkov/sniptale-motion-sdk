import type {
  EffectV1Document,
  EffectV1Asset,
} from "../../../sdk/effect-v1/index.js";
import type { EffectDefinition } from "../../../sdk/types.js";
import {
  normalizeEffectV1ToTemplate,
  validateEffectV1Document,
} from "../../../sdk/effect-v1/index.js";
import type { NormalizeEffectFileOptions } from "./validation-types.js";

export function normalizeEffectFilePayload(
  input: unknown,
  errors: string[] = [],
  options: NormalizeEffectFileOptions = {},
): {
  assets: EffectV1Asset[];
  document: EffectV1Document;
  template: EffectDefinition;
} | null {
  const validation = validateEffectV1Document(input);
  const payload = validation.document;
  if (!validation.ok || !payload) {
    errors.push(
      ...validation.diagnostics.map(
        (entry) => `${entry.code} ${entry.path}: ${entry.message}`,
      ),
    );
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
