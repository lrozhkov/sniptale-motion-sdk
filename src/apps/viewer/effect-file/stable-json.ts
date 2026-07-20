export function stableStringify(value: unknown) {
  return JSON.stringify(sortJsonValue(value), null, 2);
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonValue(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((next, key) => {
      next[key] = sortJsonValue((value as Record<string, unknown>)[key]);
      return next;
    }, {});
}
