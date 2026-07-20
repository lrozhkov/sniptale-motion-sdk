import type {
  SandboxRenderProfile,
  SandboxRenderProfileField,
} from "../../../sdk/render-profile.js";

export function createSandboxRenderProfile(
  queueMs: number | null,
): SandboxRenderProfile | null {
  if (queueMs === null) {
    return null;
  }
  return {
    assetResolveMs: 0,
    svgTextAssetCount: 0,
    svgVectorAssetCount: 0,
    bindingReadsMs: 0,
    canvasCallCount: 0,
    canvasDrawImageCount: 0,
    canvasDrawImageMs: 0,
    canvasFillCount: 0,
    canvasFillMs: 0,
    canvasFilteredDrawImageCount: 0,
    canvasFilteredDrawImageMs: 0,
    canvasGradientCount: 0,
    canvasGradientMs: 0,
    canvasRectCount: 0,
    canvasRectMs: 0,
    canvasShadowCount: 0,
    canvasShadowMs: 0,
    cacheLookupMs: 0,
    cacheStoreMs: 0,
    canvasStrokeCount: 0,
    canvasStrokeMs: 0,
    canvasTextCount: 0,
    canvasTextMs: 0,
    canvasTotalMs: 0,
    canvasSetupMs: 0,
    modelResolveMs: 0,
    normalizeMs: 0,
    presentationMs: 0,
    queueMs: Math.max(0, queueMs),
    renderContextMs: 0,
    rendererMs: 0,
    totalMs: 0,
  };
}

export function recordSandboxRenderProfilePhase(
  profile: SandboxRenderProfile | null,
  field: SandboxRenderProfileField,
  startedAt: number,
): void {
  if (profile) {
    profile[field] = Math.max(0, performance.now() - startedAt);
  }
}
