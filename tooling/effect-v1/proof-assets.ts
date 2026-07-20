export function createEffectV1AssetMaterializationProof(
  document: any,
  before: any,
  after: any,
  diagnostics: unknown,
) {
  const declared = Array.isArray(document?.assets)
    ? document.assets
        .map((asset) => asset?.id)
        .filter((id): id is string => typeof id === "string")
        .sort()
    : [];
  const visual = Array.isArray(document?.assets)
    ? document.assets
        .filter(
          (asset) =>
            asset?.kind === "image" ||
            asset?.kind === "svg" ||
            String(asset?.mimeType ?? "").startsWith("image/"),
        )
        .map((asset) => asset?.id)
        .filter((id): id is string => typeof id === "string")
        .sort()
    : [];
  const bitmapTransfers = positiveDelta(
    after?.assetBitmapTransfers,
    before?.assetBitmapTransfers,
  );
  const envelopeTransfers = positiveDelta(
    after?.assetEnvelopeTransfers,
    before?.assetEnvelopeTransfers,
  );
  const unknownAsset = /unknown asset/i.test(String(diagnostics ?? ""));
  return {
    bitmapTransfers,
    declared,
    envelopeTransfers,
    ok:
      visual.length === 0 ||
      (bitmapTransfers >= visual.length &&
        envelopeTransfers > 0 &&
        !unknownAsset),
    unknownAsset,
    visual,
  };
}

function positiveDelta(after: unknown, before: unknown): number {
  return Math.max(0, Number(after) - Number(before) || 0);
}
