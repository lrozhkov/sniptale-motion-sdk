import { MAX_ASSET_BYTES } from "../../../sdk/protocol.js";
import {
  assertEffectV1AssetSignature,
  decodeEffectV1EmbeddedAsset,
  sha256EffectV1Bytes,
} from "../../../sdk/effect-v1/index.js";

const MAX_IMPORT_ASSET_BYTES = MAX_ASSET_BYTES * 16;

export type MaterializedEffectImport = {
  source: string;
  sourceName: string;
};

export async function materializeEffectImportFiles(
  files: readonly File[],
): Promise<MaterializedEffectImport> {
  const documents = files.filter(isEffectDocumentFile);
  if (documents.length !== 1) {
    throw new Error(
      documents.length === 0
        ? "Select one .sniptale-effect.json document."
        : "Select exactly one Effect document per import.",
    );
  }
  const documentFile = documents[0];
  if (!documentFile) throw new Error("Select one Effect document.");
  const source = await documentFile.text();
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    throw new Error(
      `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!isRecord(value) || !Array.isArray(value.assets)) {
    return { source, sourceName: documentFile.name };
  }

  const candidates = indexAssetFiles(
    files.filter((file) => file !== documentFile),
  );
  const usedFiles = new Set<File>();
  let totalBytes = 0;
  const assets: unknown[] = value.assets;
  for (const [index, asset] of assets.entries()) {
    if (!isRecord(asset)) continue;
    if (hasEmbeddedContent(asset)) {
      await verifyEmbeddedAsset(asset, index);
      continue;
    }
    if (typeof asset.path !== "string") {
      throw new Error(
        `Asset ${assetLabel(asset, index)} has no embedded content.`,
      );
    }
    const file = resolveAssetFile(asset.path, candidates);
    if (!file) {
      throw new Error(
        `Missing file for asset "${assetLabel(asset, index)}": ${asset.path}. Select the document and all referenced files together.`,
      );
    }
    usedFiles.add(file);
    totalBytes += file.size;
    if (totalBytes > MAX_IMPORT_ASSET_BYTES) {
      throw new Error(
        `Selected assets exceed the ${MAX_IMPORT_ASSET_BYTES} byte import limit.`,
      );
    }
    if (file.size <= 0 || file.size > MAX_ASSET_BYTES) {
      throw new Error(
        `Asset "${assetLabel(asset, index)}" must be from 1 to ${MAX_ASSET_BYTES} bytes.`,
      );
    }
    if (file.type && asset.mimeType !== file.type) {
      throw new Error(
        `Asset "${assetLabel(asset, index)}" declares ${typeof asset.mimeType === "string" ? asset.mimeType : "no MIME type"}, but the selected file is ${file.type || "unknown"}.`,
      );
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    assertEffectV1AssetSignature(
      bytes,
      asset.mimeType,
      assetLabel(asset, index),
    );
    asset.byteLength = bytes.byteLength;
    asset.sha256 = await sha256EffectV1Bytes(bytes);
    if (asset.kind === "svg" || asset.mimeType === "image/svg+xml") {
      asset.svgText = new TextDecoder().decode(bytes);
    } else {
      asset.dataUrl = toDataUrl(bytes, file.type);
    }
  }
  const unusedFiles = files.filter(
    (file) => file !== documentFile && !usedFiles.has(file),
  );
  if (unusedFiles.length > 0) {
    throw new Error(
      `Selected file is not referenced by the Effect document: ${unusedFiles[0]?.name}.`,
    );
  }
  return {
    source: `${JSON.stringify(value, null, 2)}\n`,
    sourceName: documentFile.name,
  };
}

export async function verifyMaterializedEffectImportSource(
  source: unknown,
): Promise<string> {
  if (typeof source !== "string")
    throw new Error("Effect document source must be JSON text.");
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    throw new Error(
      `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!isRecord(value) || !Array.isArray(value.assets)) return source;
  const assets: unknown[] = value.assets;
  for (const [index, asset] of assets.entries()) {
    if (!isRecord(asset) || !hasEmbeddedContent(asset)) {
      throw new Error(
        `Asset "${isRecord(asset) ? assetLabel(asset, index) : index}" has no materialized content. Select its referenced file together with the Effect document.`,
      );
    }
    await verifyEmbeddedAsset(asset, index);
  }
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function verifyEmbeddedAsset(
  asset: Record<string, unknown>,
  index: number,
): Promise<void> {
  const bytes = decodeEffectV1EmbeddedAsset({
    ...(typeof asset.dataUrl === "string" ? { dataUrl: asset.dataUrl } : {}),
    ...(typeof asset.svgText === "string" ? { svgText: asset.svgText } : {}),
  });
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_ASSET_BYTES) {
    throw new Error(
      `Asset "${assetLabel(asset, index)}" must be from 1 to ${MAX_ASSET_BYTES} bytes.`,
    );
  }
  assertEffectV1AssetSignature(bytes, asset.mimeType, assetLabel(asset, index));
  const digest = await sha256EffectV1Bytes(bytes);
  if (asset.byteLength !== undefined && asset.byteLength !== bytes.byteLength) {
    throw new Error(
      `Asset "${assetLabel(asset, index)}" byteLength does not match its content.`,
    );
  }
  if (asset.sha256 !== undefined && asset.sha256 !== digest) {
    throw new Error(
      `Asset "${assetLabel(asset, index)}" SHA-256 does not match its content.`,
    );
  }
  asset.byteLength = bytes.byteLength;
  asset.sha256 = digest;
}

function isEffectDocumentFile(file: File): boolean {
  return (
    file.name.endsWith(".sniptale-effect.json") ||
    (file.name.endsWith(".json") && file.type === "application/json")
  );
}

function hasEmbeddedContent(asset: Record<string, unknown>): boolean {
  return typeof asset.dataUrl === "string" || typeof asset.svgText === "string";
}

function indexAssetFiles(files: readonly File[]): {
  byBaseName: Map<string, File[]>;
  byPath: Map<string, File>;
} {
  const byBaseName = new Map<string, File[]>();
  const byPath = new Map<string, File>();
  for (const file of files) {
    const relativePath = normalizePath(file.webkitRelativePath || file.name);
    if (!isSafeImportPath(relativePath)) {
      throw new Error(`Unsafe selected asset path: ${relativePath}.`);
    }
    if (byPath.has(relativePath)) {
      throw new Error(`Duplicate selected asset path: ${relativePath}.`);
    }
    byPath.set(relativePath, file);
    const list = byBaseName.get(file.name) ?? [];
    list.push(file);
    byBaseName.set(file.name, list);
  }
  return { byBaseName, byPath };
}

function resolveAssetFile(
  path: string,
  candidates: ReturnType<typeof indexAssetFiles>,
): File | null {
  const normalized = normalizePath(path);
  if (!isSafeImportPath(normalized)) return null;
  const exact = candidates.byPath.get(normalized);
  if (exact) return exact;
  const suffixMatches = [...candidates.byPath]
    .filter(([candidatePath]) => candidatePath.endsWith(`/${normalized}`))
    .map(([, file]) => file);
  if (suffixMatches.length === 1) return suffixMatches[0] ?? null;
  if (suffixMatches.length > 1) return null;
  const baseName = normalized.split("/").at(-1) ?? normalized;
  const sameName = candidates.byBaseName.get(baseName) ?? [];
  return sameName.length === 1 ? (sameName[0] ?? null) : null;
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}

function isSafeImportPath(value: string): boolean {
  if (!value || value.startsWith("/") || /^[a-z]:\//i.test(value)) return false;
  return value
    .split("/")
    .every((part) => part !== "" && part !== "." && part !== "..");
}

function toDataUrl(bytes: Uint8Array, mimeType: string): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function assetLabel(
  asset: Record<string, unknown>,
  index: number,
): string | number {
  return typeof asset.id === "string" ? asset.id : index;
}
