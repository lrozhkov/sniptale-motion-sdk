import { isValidationRecord } from "./input.js";
import type { ValidationTemplate } from "./input.js";
import type {
  AddValidationIssue,
  EditorValidationOptions,
  KnownValidationAssets,
} from "./types.js";
export function collectAssetIssues(
  template: ValidationTemplate,
  knownAssetIds: KnownValidationAssets,
  options: EditorValidationOptions,
  addIssue: AddValidationIssue,
) {
  for (const assetId of template.assets ?? []) {
    if (!knownAssetIds.has(assetId)) {
      addIssue(`Template references missing asset "${assetId}"`, {
        messageKey: "templateMissingAsset",
        messageParams: { asset: assetId },
        targetId: assetId,
        targetType: "asset",
      });
      continue;
    }
    const asset =
      "get" in knownAssetIds
        ? knownAssetIds.get(assetId)
        : options.assets?.get(assetId);
    if (
      asset !== undefined &&
      (!isValidationRecord(asset) ||
        typeof asset.path !== "string" ||
        !options.isSafeLocalAssetPath?.(asset.path))
    ) {
      const path =
        isValidationRecord(asset) && typeof asset.path === "string"
          ? asset.path
          : "(invalid)";
      addIssue(`Asset "${assetId}" has unsafe local path "${path}"`, {
        messageKey: "assetUnsafePath",
        messageParams: { asset: assetId, path },
        targetId: assetId,
        targetType: "asset",
      });
    }
    if (
      isValidationRecord(asset) &&
      asset.svgText !== undefined &&
      asset.svgText !== null &&
      (typeof asset.svgText !== "string" ||
        !options.isSafeSvgAssetText?.(asset.svgText))
    ) {
      addIssue(`Asset "${assetId}" contains unsafe SVG content`, {
        messageKey: "assetUnsafeSvg",
        messageParams: { asset: assetId },
        targetId: assetId,
        targetType: "asset",
      });
    }
  }
}
