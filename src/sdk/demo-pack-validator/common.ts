export type DemoPackIssue = { path: string; message: string };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export function isSafeLocalPath(path: unknown): path is string {
  if (typeof path !== "string" || path.trim() === "") {
    return false;
  }
  if (/^[a-z]+:/i.test(path) || path.startsWith("/") || path.includes("..")) {
    return false;
  }
  return !path.includes("\\");
}

export function push(
  errors: DemoPackIssue[],
  path: string,
  message: string,
): void {
  errors.push({ path, message });
}

export function describeValue(value: unknown): string {
  if (value === null) return "null";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === undefined
  )
    return String(value);
  return "<invalid>";
}
