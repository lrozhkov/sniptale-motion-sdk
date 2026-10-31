/** Format boundary diagnostics without invoking object conversion hooks. */
export function diagnosticValue(value: unknown): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
      return value;
    case "number":
    case "boolean":
    case "bigint":
    case "symbol":
    case "undefined":
      return String(value);
    default:
      return "(invalid)";
  }
}
