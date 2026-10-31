type DirectLiveTemplate = { id?: string; effectId?: string };
import type { ViewerAppContext } from "../app/context.js";
import type { SandboxRenderProfile } from "../../../sdk/render-profile.js";

const DIRECT_NORMALIZE_MIN_MS = 50;
const DIRECT_NORMALIZE_MIN_RATIO = 0.3;
const DIRECT_PROFILE_MAX_SAMPLES = 24;

export function beginDirectLiveRenderProfile(
  ctx: ViewerAppContext,
  template: DirectLiveTemplate | null | undefined,
  detailed: boolean,
) {
  const active = shouldProfileDirectLiveRender(ctx, template);
  return {
    commit(profile: SandboxRenderProfile | undefined) {
      if (active) {
        recordDirectLiveRenderProfile(ctx, template, profile);
      }
    },
    message:
      detailed || active
        ? {
            ...(detailed ? { profileCanvasOperations: true } : {}),
            profileRender: true,
          }
        : {},
  };
}

export function isDirectLiveRenderPreferred(
  ctx: ViewerAppContext,
  template: DirectLiveTemplate | null | undefined,
): boolean {
  return ctx.state.directLiveRenderKeys.has(
    createDirectLiveRenderKey(ctx, template),
  );
}

export function shouldProfileDirectLiveRender(
  ctx: ViewerAppContext,
  template: DirectLiveTemplate | null | undefined,
): boolean {
  const key = createDirectLiveRenderKey(ctx, template);
  return Boolean(
    ctx.state.playing &&
    ctx.state.previewCacheEnabled === false &&
    ctx.state.directRenderEffectIds.has(template?.effectId ?? "") &&
    ctx.state.directRenderResponsePort?.presentationSurfaceAttached &&
    !ctx.state.directLiveRenderKeys.has(key) &&
    !ctx.state.directLiveProfileCompleteKeys.has(key),
  );
}

export function recordDirectLiveRenderProfile(
  ctx: ViewerAppContext,
  template: DirectLiveTemplate | null | undefined,
  profile: SandboxRenderProfile | undefined,
): void {
  if (!profile) {
    return;
  }
  const key = createDirectLiveRenderKey(ctx, template);
  const samples = (ctx.state.directLiveProfileSamples.get(key) ?? 0) + 1;
  ctx.state.directLiveProfileSamples.set(key, samples);
  const normalizeRatio =
    profile.normalizeMs / Math.max(1, profile.totalMs - profile.queueMs);
  if (
    profile.normalizeMs >= DIRECT_NORMALIZE_MIN_MS &&
    normalizeRatio >= DIRECT_NORMALIZE_MIN_RATIO
  ) {
    ctx.state.directLiveRenderKeys.add(key);
    ctx.state.directLiveProfileCompleteKeys.add(key);
    return;
  }
  if (samples >= DIRECT_PROFILE_MAX_SAMPLES) {
    ctx.state.directLiveProfileCompleteKeys.add(key);
  }
}

export function createDirectLiveRenderKey(
  ctx: ViewerAppContext,
  template: DirectLiveTemplate | null | undefined,
): string {
  return `${template?.effectId ?? template?.id ?? "effect"}:${ctx.state.previewRasterWidth}x${ctx.state.previewRasterHeight}`;
}
