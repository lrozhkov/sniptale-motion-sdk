export const SANDBOX_RENDER_PROFILE_FIELDS = [
  "queueMs",
  "modelResolveMs",
  "assetResolveMs",
  "svgTextAssetCount",
  "svgVectorAssetCount",
  "cacheLookupMs",
  "canvasSetupMs",
  "renderContextMs",
  "rendererMs",
  "normalizeMs",
  "bindingReadsMs",
  "cacheStoreMs",
  "presentationMs",
  "canvasCallCount",
  "canvasTotalMs",
  "canvasDrawImageCount",
  "canvasDrawImageMs",
  "canvasFilteredDrawImageCount",
  "canvasFilteredDrawImageMs",
  "canvasFillCount",
  "canvasFillMs",
  "canvasStrokeCount",
  "canvasStrokeMs",
  "canvasRectCount",
  "canvasRectMs",
  "canvasTextCount",
  "canvasTextMs",
  "canvasGradientCount",
  "canvasGradientMs",
  "canvasShadowCount",
  "canvasShadowMs",
  "totalMs",
] as const;

export type SandboxRenderProfileField =
  (typeof SANDBOX_RENDER_PROFILE_FIELDS)[number];

export type SandboxRenderProfile = Record<SandboxRenderProfileField, number>;

export function parseSandboxRenderProfile(
  value: unknown,
): SandboxRenderProfile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const source = value as Record<string, unknown>;
  const profile = {} as SandboxRenderProfile;
  for (const field of SANDBOX_RENDER_PROFILE_FIELDS) {
    const timing = source[field];
    if (typeof timing !== "number" || !Number.isFinite(timing) || timing < 0) {
      return null;
    }
    profile[field] = timing;
  }
  return profile;
}
