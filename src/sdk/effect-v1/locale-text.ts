import { isEffectV1LocaleTag } from "./locale-tags.js";
import type { ControlDefinition, LocaleText } from "../types.js";

/** Resolve portable metadata without translating user-authored control values. */
export function resolveEffectV1LocaleText(
  text: LocaleText | undefined,
  locale: string,
  fallback = "",
): string {
  if (!text) return fallback;
  const canonical = isEffectV1LocaleTag(locale) ? locale : "en";
  const entries = new Map(
    Object.entries(text).map(([key, value]) => [key.toLowerCase(), value]),
  );
  for (const key of [
    canonical.toLowerCase(),
    canonical.split("-")[0].toLowerCase(),
    "en",
  ]) {
    const value = entries.get(key);
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
}

/** Resolve a validated template default only when creating a new instance.
 * Restoring, duplicating or changing locale must retain the instance controls.
 */
export function resolveEffectV1ControlDefault(
  control: ControlDefinition,
  locale: string,
): string | number {
  return control.kind === "text"
    ? resolveEffectV1LocaleText(
        control.localizedDefaultValue,
        locale,
        control.defaultValue,
      )
    : control.defaultValue;
}
