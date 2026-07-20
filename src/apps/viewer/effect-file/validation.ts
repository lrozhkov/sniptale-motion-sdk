import { parseEffectV1Source } from "../../../sdk/effect-v1/index.js";
import { normalizeEffectFilePayload } from "./validation-normalization.js";
import { parseSniptaleEffectFilePayload } from "./validation-parser.js";
import type {
  EffectFileValidationResult,
  ValidateEffectFileOptions,
} from "./validation-types.js";

export type { EffectFileValidationResult } from "./validation-types.js";
export { validateEffectFileAssetPayload } from "./validation-assets.js";
export { normalizeEffectFilePayload } from "./validation-normalization.js";
export { parseSniptaleEffectFilePayload } from "./validation-parser.js";

export function validateSniptaleEffectFile(
  source: unknown,
  options: ValidateEffectFileOptions = {},
): EffectFileValidationResult {
  const errors: string[] = [];
  if (typeof source !== "string" || source.trim() === "") {
    return { errors: ["Effect file source is empty"], ok: false };
  }
  const validation = parseEffectV1Source(source);
  errors.push(
    ...validation.diagnostics.map(
      (diagnostic) =>
        `${diagnostic.code} ${diagnostic.path}: ${diagnostic.message}${
          diagnostic.suggestion ? ` Fix: ${diagnostic.suggestion}` : ""
        }`,
    ),
  );
  const payload = validation.document;
  if (payload) {
    const normalized = normalizeEffectFilePayload(payload, errors, options);
    if (normalized) {
      const knownAssetIds = new Set<string>(
        normalized.assets.map((asset: any) => String(asset.id)),
      );
      errors.push(
        ...(options.collectTemplateErrors?.(
          normalized.template,
          knownAssetIds,
        ) ?? []),
      );
    }
  }
  return { errors, ok: errors.length === 0, payload };
}
