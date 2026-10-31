import { MAX_ASSET_BYTES, MAX_RENDER_PIXELS } from "../../../sdk/protocol.js";
import { isSafeSvgAssetText } from "../assets/model.js";
import {
  SUPPORTED_AUTHOR_ASSET_TYPES,
  isSafeLocalAssetPath,
} from "../app/constants.js";

export function validateEffectFileAssetPayload(
  asset: unknown,
  errors: string[],
  options: { isSafeSvgAssetText?: (svgText: unknown) => boolean } = {},
): void {
  if (!isRecord(asset)) {
    errors.push("Effect file asset entry must be an object");
    return;
  }
  const assetId = typeof asset.id === "string" ? asset.id : "(missing)";
  if (!isSafeLocalAssetPath(asset.path)) {
    errors.push(
      `Effect file asset "${assetId}" has unsafe path "${describeValue(asset.path)}"`,
    );
  }
  if (
    asset.mimeType != null &&
    (typeof asset.mimeType !== "string" ||
      !SUPPORTED_AUTHOR_ASSET_TYPES.has(asset.mimeType))
  ) {
    errors.push(
      `Effect file asset "${assetId}" has unsupported mime type "${describeValue(asset.mimeType)}"`,
    );
  }
  if (asset.kind != null && asset.kind !== "image" && asset.kind !== "svg") {
    errors.push(
      `Effect file asset "${assetId}" has unsupported kind "${describeValue(asset.kind)}"`,
    );
  }
  const width = typeof asset.width === "number" ? asset.width : NaN;
  const height = typeof asset.height === "number" ? asset.height : NaN;
  if (
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0 &&
    width * height > MAX_RENDER_PIXELS
  ) {
    errors.push(
      `Effect file asset "${assetId}" dimensions exceed preview safety limit`,
    );
  }
  if (asset.svgText != null) {
    if (asset.mimeType !== "image/svg+xml" && asset.kind !== "svg") {
      errors.push(
        `Effect file asset "${assetId}" embeds SVG text without SVG metadata`,
      );
    }
    const isSafeSvgText = options.isSafeSvgAssetText ?? isSafeSvgAssetText;
    if (!isSafeSvgText(asset.svgText)) {
      errors.push(`Effect file asset "${assetId}" contains unsafe SVG content`);
    }
  }
  if (asset.dataUrl != null) {
    if (
      typeof asset.dataUrl !== "string" ||
      !/^data:image\/(?:png|jpeg|webp);base64,/i.test(asset.dataUrl)
    ) {
      errors.push(
        `Effect file asset "${assetId}" has unsupported embedded image data`,
      );
    }
    if (
      typeof asset.dataUrl === "string" &&
      asset.dataUrl.length > MAX_ASSET_BYTES * 2
    ) {
      errors.push(
        `Effect file asset "${assetId}" embedded image data is too large`,
      );
    }
  }
  if (asset.mimeType === "image/svg+xml" && !asset.svgText) {
    errors.push(`Effect file asset "${assetId}" is missing SVG text`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function describeValue(value: unknown): string {
  return typeof value === "string" ? value : "(invalid)";
}
