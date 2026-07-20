export function recordRenderAssetProfile(profile: any, assets: any): void {
  if (!profile) return;
  const values = Object.values(assets);
  profile.svgTextAssetCount = values.filter(
    (asset: any) => typeof asset?.svgText === "string",
  ).length;
  profile.svgVectorAssetCount = values.filter((asset: any) =>
    Boolean(asset?.svgVector),
  ).length;
}
