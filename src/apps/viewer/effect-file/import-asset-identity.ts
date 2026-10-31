import type { EffectV1Document } from "../../../sdk/effect-v1/index.js";

export function remapImportedAssetIdentity(
  document: EffectV1Document,
  existingIds: Iterable<string>,
  namespace: string,
): EffectV1Document {
  const clone = structuredClone(document);
  const used = new Set(existingIds);
  const remap = new Map<string, string>();
  for (const asset of clone.assets) {
    const original = asset.id;
    const next = createUniqueAssetId(original, namespace, used);
    used.add(next);
    if (next !== original) remap.set(original, next);
    asset.id = next;
  }
  if (remap.size === 0) return clone;
  for (const layer of clone.layers) {
    const next =
      typeof layer.assetId === "string" ? remap.get(layer.assetId) : undefined;
    if (next !== undefined) layer.assetId = next;
  }
  remapAssetReferences(clone.program.commands, remap);
  return clone;
}

function createUniqueAssetId(
  original: string,
  namespace: string,
  used: Set<string>,
): string {
  if (!used.has(original)) return original;
  const safeNamespace = namespace.replace(/[^a-z0-9._-]+/gi, "-");
  const base = `${safeNamespace}-${original}`;
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function remapAssetReferences(
  commands: unknown[],
  remap: Map<string, string>,
): void {
  for (const command of commands) {
    if (!isRecord(command)) continue;
    const next =
      typeof command.assetId === "string"
        ? remap.get(command.assetId)
        : undefined;
    if (next !== undefined) command.assetId = next;
    if (Array.isArray(command.commands)) {
      remapAssetReferences(command.commands, remap);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
