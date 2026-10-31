import { EFFECT_V1_JSON_SCHEMA } from "../../sdk/effect-v1/schema.js";

const fields = new Set<string>();
const visited = new WeakSet<object>();
function collect(value: unknown): void {
  if (value === null || typeof value !== "object" || visited.has(value)) return;
  visited.add(value);
  if (Array.isArray(value)) {
    for (const item of value) collect(item);
    return;
  }
  if (
    "properties" in value &&
    value.properties !== null &&
    typeof value.properties === "object"
  )
    for (const field of Object.keys(value.properties)) fields.add(field);
  for (const item of Object.values(value)) collect(item);
}
collect(EFFECT_V1_JSON_SCHEMA);

export function publicDiagnosticPath(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 4096 ||
    !value.startsWith("$")
  )
    return "$";
  let path = "$";
  const tokens = /(?:\.([a-zA-Z_][a-zA-Z0-9_]*)|\[([0-9]+)\])/y;
  let offset = 1;
  while (offset < value.length) {
    tokens.lastIndex = offset;
    const match = tokens.exec(value);
    if (!match || (match[1] !== undefined && !fields.has(match[1])))
      return `${path}.<field>`;
    path += match[0];
    offset = tokens.lastIndex;
  }
  return path;
}
