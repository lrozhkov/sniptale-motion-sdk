import type { DemoPackIssue } from "./common.js";
import { MAX_ASSET_BYTES } from "../protocol.js";
import { isSafeSvgText } from "../svg-safety.js";
import { describeValue, isRecord, isSafeLocalPath, push } from "./common.js";

export const ASSET_KINDS = new Set(["audio", "image", "svg"]);
export const ASSET_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

export function validateAssetEntry(
  item: unknown,
  index: number,
  errors: DemoPackIssue[],
): void {
  if (!isRecord(item)) {
    push(errors, `manifest.assets.${index}`, "Expected asset entry.");
    return;
  }
  if (!isSafeLocalPath(item.path)) {
    push(
      errors,
      `manifest.assets.${index}.path`,
      "Expected safe local asset path.",
    );
  }
  if (typeof item.id !== "string" || item.id.trim() === "") {
    push(errors, `manifest.assets.${index}.id`, "Expected asset id.");
  }
  if (typeof item.kind !== "string" || !ASSET_KINDS.has(item.kind)) {
    push(errors, `manifest.assets.${index}.kind`, "Expected known asset kind.");
  }
  if (
    typeof item.mimeType !== "string" ||
    !ASSET_MIME_TYPES.has(item.mimeType)
  ) {
    push(
      errors,
      `manifest.assets.${index}.mimeType`,
      "Expected supported asset mime type.",
    );
  }
  if (typeof item.size === "number" && item.size > MAX_ASSET_BYTES) {
    push(
      errors,
      `manifest.assets.${index}.size`,
      `Asset exceeds ${MAX_ASSET_BYTES} bytes.`,
    );
  }
}

export async function readAssets(
  baseUrl: string,
  manifest: Record<string, unknown>,
  errors: DemoPackIssue[],
) {
  const assets = new Map<
    string,
    NonNullable<Awaited<ReturnType<typeof readAsset>>>
  >();
  if (!Array.isArray(manifest.assets)) {
    return assets;
  }
  for (const item of manifest.assets) {
    if (
      !isRecord(item) ||
      !isSafeLocalPath(item.path) ||
      typeof item.id !== "string" ||
      typeof item.kind !== "string" ||
      !ASSET_KINDS.has(item.kind) ||
      typeof item.mimeType !== "string" ||
      !ASSET_MIME_TYPES.has(item.mimeType)
    ) {
      continue;
    }
    const asset = await readAsset(
      `${baseUrl}${item.path}`,
      {
        ...item,
        id: item.id,
        path: item.path,
        kind: item.kind,
        mimeType: item.mimeType,
      },
      errors,
    );
    if (asset) {
      assets.set(item.id, asset);
    }
  }
  return assets;
}

export function validateTemplateAssetRefs(
  assets: ReadonlyMap<string, unknown>,
  templates: readonly Record<string, unknown>[],
  errors: DemoPackIssue[],
): void {
  for (const template of templates) {
    if (!Array.isArray(template.assets)) {
      continue;
    }
    for (const assetId of template.assets) {
      if (typeof assetId !== "string" || !assets.has(assetId)) {
        push(
          errors,
          `templates.${describeValue(template.id)}.assets`,
          `Unknown asset ${describeValue(assetId)}.`,
        );
      }
    }
  }
}

async function readAsset(
  url: string,
  item: Record<string, unknown> & {
    id: string;
    path: string;
    kind: string;
    mimeType: string;
  },
  errors: DemoPackIssue[],
) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      push(errors, item.path, `Missing asset (${response.status}).`);
      return null;
    }
    const blob = await response.blob();
    if (blob.size > MAX_ASSET_BYTES) {
      push(errors, item.path, `Asset exceeds ${MAX_ASSET_BYTES} bytes.`);
      return null;
    }
    if (typeof item.size === "number" && item.size !== blob.size) {
      push(
        errors,
        item.path,
        `Asset size mismatch: expected ${item.size}, got ${blob.size}.`,
      );
      return null;
    }
    const mimeType = item.mimeType || blob.type;
    if (!ASSET_MIME_TYPES.has(mimeType)) {
      push(errors, item.path, `Unsupported asset mime type ${mimeType}.`);
      return null;
    }
    let svgText = null;
    if (mimeType === "image/svg+xml") {
      svgText = await blob.text();
      validateSvgText(svgText, item.path, errors);
    }
    return {
      blob,
      byteLength: blob.size,
      dataUrl: mimeType === "image/svg+xml" ? null : await blobToDataUrl(blob),
      height: typeof item.height === "number" ? item.height : undefined,
      id: item.id,
      kind: item.kind,
      mimeType,
      path: item.path,
      svgText,
      width: typeof item.width === "number" ? item.width : undefined,
    };
  } catch (error) {
    push(
      errors,
      item.path,
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:${blob.type};base64,${btoa(binary)}`;
}

function validateSvgText(
  text: string,
  path: string,
  errors: DemoPackIssue[],
): void {
  if (!isSafeSvgText(text)) {
    push(errors, path, "Expected SVG without executable or external content.");
  }
}
