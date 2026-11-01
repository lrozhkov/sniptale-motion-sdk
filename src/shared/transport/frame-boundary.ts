export function isValidPresentedFrame(value: Record<string, unknown>): boolean {
  return (
    value.presented === true &&
    // This field was added after direct presentation shipped. Keep it
    // optional across a worker/sandbox version skew during development.
    (value.presentedAtEpochMs === undefined ||
      (typeof value.presentedAtEpochMs === "number" &&
        Number.isFinite(value.presentedAtEpochMs) &&
        value.presentedAtEpochMs > 0)) &&
    typeof value.presentedAtMs === "number" &&
    Number.isFinite(value.presentedAtMs) &&
    value.presentedAtMs >= 0 &&
    typeof value.previewWidth === "number" &&
    Number.isFinite(value.previewWidth) &&
    value.previewWidth > 0 &&
    typeof value.previewHeight === "number" &&
    Number.isFinite(value.previewHeight) &&
    value.previewHeight > 0
  );
}
export function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}
export function isOptionalBoolean(
  value: unknown,
): value is boolean | undefined {
  return value === undefined || typeof value === "boolean";
}
export function isOptionalNonNegativeFiniteNumber(
  value: unknown,
): value is number | undefined {
  return (
    value === undefined ||
    (typeof value === "number" && Number.isFinite(value) && value >= 0)
  );
}
export function isOptionalStringArray(
  value: unknown,
): value is string[] | undefined {
  return (
    value === undefined ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"))
  );
}
export function isOptionalPreviewCacheStorage(
  value: unknown,
): value is "bitmap" | "mixed" | "none" | "png" | undefined {
  return (
    value === undefined ||
    value === "bitmap" ||
    value === "mixed" ||
    value === "none" ||
    value === "png"
  );
}
