import { MAX_ASSET_BYTES, MAX_RENDER_PIXELS } from "../../../sdk/protocol.js";
import { isSafeSvgAssetText } from "../assets/model.js";
import {
  SUPPORTED_AUTHOR_ASSET_TYPES,
  isSafeLocalAssetPath,
} from "../app/constants.js";

export function validateEffectFileAssetPayload(
  asset: any,
  errors: string[],
  options: { isSafeSvgAssetText?: (svgText: unknown) => boolean } = {},
): void {
  const assetId = asset?.id ?? "(missing)";
  if (!asset || typeof asset !== "object") {
    errors.push("Effect file asset entry must be an object");
    return;
  }
  if (!isSafeLocalAssetPath(asset.path)) {
    errors.push(
      `Effect file asset "${assetId}" has unsafe path "${asset.path}"`,
    );
  }
  if (
    asset.mimeType != null &&
    !SUPPORTED_AUTHOR_ASSET_TYPES.has(asset.mimeType)
  ) {
    errors.push(
      `Effect file asset "${assetId}" has unsupported mime type "${asset.mimeType}"`,
    );
  }
  if (asset.kind != null && !["image", "svg"].includes(asset.kind)) {
    errors.push(
      `Effect file asset "${assetId}" has unsupported kind "${asset.kind}"`,
    );
  }
  const width = Number(asset.width);
  const height = Number(asset.height);
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
    if (!/^data:image\/(?:png|jpeg|webp);base64,/i.test(asset.dataUrl)) {
      errors.push(
        `Effect file asset "${assetId}" has unsupported embedded image data`,
      );
    }
    if (asset.dataUrl.length > MAX_ASSET_BYTES * 2) {
      errors.push(
        `Effect file asset "${assetId}" embedded image data is too large`,
      );
    }
  }
  if (asset.mimeType === "image/svg+xml" && !asset.svgText) {
    errors.push(`Effect file asset "${assetId}" is missing SVG text`);
  }
}
