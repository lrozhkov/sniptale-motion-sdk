/** Require a fixture value at an index before using it in an assertion. */
export function requiredEntry<T>(values: readonly T[], index: number): T {
  const value = values[index];
  if (value === undefined)
    throw new Error(`Missing fixture entry at index ${index}.`);
  return value;
}
