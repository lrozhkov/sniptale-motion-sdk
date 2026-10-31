export function parseRetainedAssetIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 50_000) return null;
  const values: unknown[] = value;
  const result: string[] = [];
  let characters = 0;
  for (const id of values) {
    if (typeof id !== "string" || id.length === 0 || id.length > 512)
      return null;
    characters += id.length;
    if (characters > 3_000_000) return null;
    result.push(id);
  }
  return result;
}
