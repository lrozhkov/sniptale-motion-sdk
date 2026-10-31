import type { SandboxRenderProfile } from "../../../sdk/render-profile.js";

export function recordRenderAssetProfile(
  profile: Pick<
    SandboxRenderProfile,
    "svgTextAssetCount" | "svgVectorAssetCount"
  > | null,
  assets: unknown,
): void {
  if (!profile) return;
  const values = isRecord(assets) ? Object.values(assets) : [];
  profile.svgTextAssetCount = values.filter(
    (asset) => isRecord(asset) && typeof asset.svgText === "string",
  ).length;
  profile.svgVectorAssetCount = values.filter(
    (asset) => isRecord(asset) && Boolean(asset.svgVector),
  ).length;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
