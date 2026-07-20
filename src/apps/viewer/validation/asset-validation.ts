export function collectAssetIssues(template, knownAssetIds, options, addIssue) {
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
      knownAssetIds instanceof Map
        ? knownAssetIds.get(assetId)
        : options.assets?.get(assetId);
    if (asset && !options.isSafeLocalAssetPath?.(asset.path)) {
      addIssue(`Asset "${assetId}" has unsafe local path "${asset.path}"`, {
        messageKey: "assetUnsafePath",
        messageParams: { asset: assetId, path: String(asset.path) },
        targetId: assetId,
        targetType: "asset",
      });
    }
    if (asset?.svgText && !options.isSafeSvgAssetText?.(asset.svgText)) {
      addIssue(`Asset "${assetId}" contains unsafe SVG content`, {
        messageKey: "assetUnsafeSvg",
        messageParams: { asset: assetId },
        targetId: assetId,
        targetType: "asset",
      });
    }
  }
}
