function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function inputRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  return value;
}

/** Observe a response without inventing a shared schema for unrelated commands. */
export function responseField(
  value: unknown,
  ...path: readonly (string | number)[]
): unknown {
  let current = value;
  for (const key of path) {
    if (typeof key === "number") {
      const entries: readonly unknown[] = responseArray(current);
      if (!Number.isSafeInteger(key) || key < 0 || key >= entries.length) {
        throw new Error(`Response array has no index ${key}.`);
      }
      current = entries[key];
    } else {
      const record = inputRecord(current, "Response");
      if (!Object.hasOwn(record, key))
        throw new Error(`Response has no field ${key}.`);
      current = record[key];
    }
  }
  return current;
}

export function responseString(
  value: unknown,
  ...path: readonly (string | number)[]
): string {
  const field = responseField(value, ...path);
  if (typeof field !== "string")
    throw new Error("Response field must be a string.");
  return field;
}

export function responseNumber(
  value: unknown,
  ...path: readonly (string | number)[]
): number {
  const field = responseField(value, ...path);
  if (typeof field !== "number" || !Number.isFinite(field))
    throw new Error("Response field must be a finite number.");
  return field;
}

export function responseArray(
  value: unknown,
  ...path: readonly (string | number)[]
): readonly unknown[] {
  const field = responseField(value, ...path);
  if (!Array.isArray(field))
    throw new Error("Response field must be an array.");
  return field;
}

export function responseEnvironment(value: unknown): Record<string, string> {
  const record = inputRecord(value, "Installer environment");
  const result: Record<string, string> = {};
  for (const [key, field] of Object.entries(record)) {
    if (typeof field !== "string")
      throw new Error("Installer environment values must be strings.");
    result[key] = field;
  }
  return result;
}

export function responseObject(
  value: unknown,
  ...path: readonly (string | number)[]
): Record<string, unknown> {
  return inputRecord(responseField(value, ...path), "Response");
}
