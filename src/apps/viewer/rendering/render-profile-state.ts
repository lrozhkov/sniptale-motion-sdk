import type { ViewerAppContext } from "../app/context.js";
import type { SandboxRenderProfile } from "../../../sdk/render-profile.js";

const VIEWER_RENDER_PROFILE_FIELDS = [
  "modelMs",
  "inputFramesMs",
  "assetsMs",
  "modelEnvelopeMs",
  "messageMs",
  "requestMs",
  "videoCacheMs",
  "presentationMs",
  "postProcessMs",
] as const;

type ViewerRenderProfileField = (typeof VIEWER_RENDER_PROFILE_FIELDS)[number];

export function beginViewerRenderProfile(enabled: boolean) {
  if (!enabled) {
    return null;
  }
  const startedAt = performance.now();
  let phaseStartedAt = startedAt;
  const viewer = Object.fromEntries(
    VIEWER_RENDER_PROFILE_FIELDS.map((field) => [field, 0]),
  ) as Record<ViewerRenderProfileField, number>;
  return {
    finish(
      ctx: ViewerAppContext,
      options: {
        height: number;
        sandbox?: SandboxRenderProfile;
        templateId: string;
        time: number;
        width: number;
      },
    ) {
      ctx.state.lastRenderProfile = {
        height: options.height,
        sandbox: options.sandbox ?? null,
        templateId: options.templateId,
        time: options.time,
        totalMs: Math.max(0, performance.now() - startedAt),
        viewer,
        width: options.width,
      };
    },
    mark(field: ViewerRenderProfileField) {
      const now = performance.now();
      viewer[field] = Math.max(0, now - phaseStartedAt);
      phaseStartedAt = now;
    },
  };
}
