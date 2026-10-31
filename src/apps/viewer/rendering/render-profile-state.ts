import type { ViewerRenderTimings } from "./state.js";
import type { ViewerAppContext } from "../app/context.js";
import type { SandboxRenderProfile } from "../../../sdk/render-profile.js";

export function beginViewerRenderProfile(enabled: boolean) {
  if (!enabled) {
    return null;
  }
  const startedAt = performance.now();
  let phaseStartedAt = startedAt;
  const viewer: ViewerRenderTimings = {
    modelMs: 0,
    inputFramesMs: 0,
    assetsMs: 0,
    modelEnvelopeMs: 0,
    messageMs: 0,
    requestMs: 0,
    videoCacheMs: 0,
    presentationMs: 0,
    postProcessMs: 0,
  };
  return {
    finish(
      ctx: Pick<ViewerAppContext, "state">,
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
        viewer: { ...viewer },
        width: options.width,
      };
    },
    mark(field: keyof ViewerRenderTimings) {
      const now = performance.now();
      viewer[field] = Math.max(0, now - phaseStartedAt);
      phaseStartedAt = now;
    },
  };
}
