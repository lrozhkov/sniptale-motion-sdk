export function optional(
  record: Record<string, unknown>,
  key: string,
  accepts: (value: unknown) => boolean,
): boolean {
  return !Object.hasOwn(record, key) || accepts(record[key]);
}
export function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
export function isString(value: unknown): value is string {
  return typeof value === "string";
}
export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}
export function nullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}
export function isList(value: unknown): value is unknown[] {
  return Array.isArray(value);
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
