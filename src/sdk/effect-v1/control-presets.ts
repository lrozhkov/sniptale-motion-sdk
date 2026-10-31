import type { EffectV1Document } from "./types.js";
import { inspectControlPresetValues } from "./control-presets-validation.js";

/** Validate persisted or user-authored visual overrides against a validated document. */
export function validateEffectV1ControlPresetValues(
  document: EffectV1Document,
  values: unknown,
) {
  const diagnostics: { code: string; path: string; message: string }[] = [];
  inspectControlPresetValues(document, values, "$.values", {
    error(code, path, message) {
      diagnostics.push({ code, path, message });
    },
  });
  return { ok: diagnostics.length === 0, diagnostics };
}

/** Merge only validated visual overrides; never initialize missing instance controls. */
export function applyEffectV1ControlPresetValues<T>(
  document: EffectV1Document,
  current: Readonly<Record<string, T>>,
  values: unknown,
): Record<string, T | string | number> {
  const result = validateEffectV1ControlPresetValues(document, values);
  if (!result.ok || !isControlValues(values))
    throw new Error(
      result.diagnostics.map((d) => `${d.code}: ${d.path}`).join("; "),
    );
  return { ...current, ...values };
}

/** Apply a named visual preset without resetting instance text or geometry. */
export function applyEffectV1ControlPreset<T>(
  document: EffectV1Document,
  current: Readonly<Record<string, T>>,
  presetId: string,
): Record<string, T | string | number> {
  const preset = document.controlPresets?.find((item) => item.id === presetId);
  if (!preset) throw new Error(`Unknown control preset: ${presetId}`);
  return applyEffectV1ControlPresetValues(document, current, preset.values);
}

function isControlValues(
  value: unknown,
): value is Record<string, string | number> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (entry) => typeof entry === "string" || typeof entry === "number",
    )
  );
}
