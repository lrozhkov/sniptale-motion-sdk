import type { EffectV1ValidationErrorReport } from "./diagnostics.js";
import { isEffectV1LocaleTag } from "./locale-tags.js";
import { isSafeSvgText } from "../svg-safety.js";

export const IDENTIFIER_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/i;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string,
  report: EffectV1ValidationErrorReport,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      report.error(
        "UNKNOWN_FIELD",
        `${path}.${key}`,
        `Unknown field "${key}".`,
        "Remove it or use a field defined by v1; unknown data is never ignored.",
      );
    }
  }
}

export function requireIdentifier(
  value: unknown,
  path: string,
  report: EffectV1ValidationErrorReport,
): value is string {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) {
    report.error(
      "IDENTIFIER",
      path,
      "Expected a safe identifier (letters, digits, dot, underscore, dash).",
    );
    return false;
  }
  return true;
}

export function requireString(
  value: unknown,
  path: string,
  report: EffectV1ValidationErrorReport,
): value is string {
  if (typeof value !== "string" || value.trim() === "") {
    report.error("STRING_REQUIRED", path, "Expected a non-empty string.");
    return false;
  }
  return true;
}

export function requirePositiveNumber(
  value: unknown,
  path: string,
  report: EffectV1ValidationErrorReport,
): value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    report.error("POSITIVE_NUMBER", path, "Expected a positive finite number.");
    return false;
  }
  return true;
}

export function validateRange(
  startValue: unknown,
  durationValue: unknown,
  duration: number,
  path: string,
  report: EffectV1ValidationErrorReport,
): void {
  const start = startValue;
  const itemDuration = durationValue;
  if (!isFiniteNumber(start) || start < 0) {
    report.error(
      "RANGE_START",
      `${path}.start`,
      "Expected a non-negative start.",
    );
  }
  if (!isFiniteNumber(itemDuration) || itemDuration <= 0) {
    report.error(
      "RANGE_DURATION",
      `${path}.duration`,
      "Expected a positive duration.",
    );
  }
  if (
    isFiniteNumber(start) &&
    isFiniteNumber(itemDuration) &&
    start + itemDuration > duration + 1e-6
  ) {
    report.error(
      "RANGE_OUTSIDE_EFFECT",
      path,
      "Range exceeds the effect duration.",
    );
  }
}

export function validateLocaleText(
  value: unknown,
  path: string,
  _requireRu: boolean,
  report: EffectV1ValidationErrorReport,
): void {
  if (!isRecord(value)) {
    report.error("LOCALE_TEXT", path, "Expected a locale text object.");
    return;
  }
  if (typeof value.en !== "string" || value.en.trim() === "") {
    report.error(
      "LOCALE_EN_REQUIRED",
      `${path}.en`,
      "English fallback text is required.",
    );
  }
  for (const [locale, text] of Object.entries(value)) {
    if (!isEffectV1LocaleTag(locale) || typeof text !== "string") {
      report.error(
        "LOCALE_ENTRY",
        `${path}.${locale}`,
        "Expected a locale string.",
      );
    }
  }
}

export function isSafeRelativePath(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    !value.startsWith("/") &&
    !value.includes("\\") &&
    !value.split("/").includes("..") &&
    !/^[a-z]+:/i.test(value)
  );
}

export function isSafeSvg(value: unknown): boolean {
  return isSafeSvgText(value);
}

export function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function hasKnownIdentifier(
  value: unknown,
  identifiers: ReadonlyMap<string, unknown> | ReadonlySet<string>,
): value is string {
  return typeof value === "string" && identifiers.has(value);
}
