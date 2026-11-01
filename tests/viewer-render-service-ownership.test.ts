import { afterEach, describe, expect, it, vi } from "vitest";
import { renderCurrentFrame } from "../src/apps/viewer/rendering/service";
import type { SandboxRenderResponse } from "../src/apps/viewer/transport/contract.js";
import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import { createNativeBitmapFixture } from "./helpers/native-render-fixtures.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("preview result ownership before cache commits", () => {
  it.each([
    { mode: "restarted", commits: 0, stale: 1 },
    { mode: "replaced", commits: 0, stale: 1 },
    { mode: "out-of-order", commits: 0, stale: 1 },
    { mode: "failed", commits: 0, stale: 0 },
    { mode: "commit-error", commits: 1, stale: 0 },
  ] as const)(
    "discards $mode results before touching cache authority",
    async ({ mode, commits, stale }) => {
      const ctx = createViewerContextFixture();
      const template = { id: "effect", duration: 2, moduleId: "module" };
      const bitmap = createNativeBitmapFixture();
      const close = vi.spyOn(bitmap, "close");
      ctx.state.currentTemplate = template;
      ctx.state.sandboxReady = true;
      ctx.state.loadedModules.add("module");
      ctx.state.sandboxRuntimeGeneration = 1;
      ctx.state.previewCacheEnabled = false;
      ctx.refs.timeSlider.value = "0";
      ctx.refs.fpsInput.value = "30";
      ctx.deps.t = (key, fallback) => fallback ?? key;
      vi.spyOn(ctx, "disposeDomMotionSurface").mockImplementation(() => {});
      vi.spyOn(ctx, "setRenderStatus").mockImplementation(() => {});
      vi.spyOn(ctx, "getRenderTemplateSnapshot").mockReturnValue({
        ...template,
        layers: [],
        clips: [],
        scenes: [],
        timeline: { duration: 2, phases: [], tracks: [] },
      });
      vi.spyOn(ctx, "getCompositionDesignSize").mockReturnValue({
        width: 1280,
        height: 720,
      });
      vi.spyOn(ctx, "getPreviewRasterSize").mockReturnValue({
        width: 1280,
        height: 720,
      });
      vi.spyOn(ctx, "getPreviewRenderPlan").mockReturnValue({
        width: 1280,
        height: 720,
        scale: 1,
        renderQuality: "full",
      });
      vi.spyOn(ctx, "isPreviewFullscreenActive").mockReturnValue(false);
      vi.spyOn(ctx, "createRenderInputFrames").mockResolvedValue({
        frames: {},
        transfer: [],
      });
      vi.spyOn(ctx, "createRenderAssets").mockResolvedValue({
        cacheKeys: [],
        envelope: { renderAssetsId: "assets" },
        transfer: [],
      });
      vi.spyOn(ctx, "createRenderModelEnvelope").mockReturnValue({});
      vi.spyOn(ctx, "shouldUseDirectPreviewSurface").mockReturnValue(false);
      const commitAssets = vi
        .spyOn(ctx, "commitRenderAssetTransfers")
        .mockImplementation(() => {
          if (mode === "commit-error") throw new Error("commit failed");
        });
      const commitModel = vi
        .spyOn(ctx, "commitRenderModelEnvelope")
        .mockImplementation(() => {});
      const healthy = vi
        .spyOn(ctx, "markSandboxRenderHealthy")
        .mockImplementation(() => {});
      const draw = vi
        .spyOn(ctx, "drawCompletedFrame")
        .mockImplementation(() => {});
      const idle = vi
        .spyOn(ctx, "resolveRenderIdleWaiters")
        .mockImplementation(() => {});
      vi.spyOn(ctx, "logDiagnostic").mockImplementation(() => {});
      const request = vi
        .spyOn(ctx, "requestSandbox")
        .mockImplementation(async (): Promise<SandboxRenderResponse> => {
          if (mode === "restarted") ctx.state.sandboxRuntimeGeneration++;
          if (mode === "replaced") ctx.state.currentTemplate = { ...template };
          if (mode === "out-of-order") ctx.state.frameSequence++;
          return {
            kind: "renderFrameResult",
            requestId: "frame",
            ok: mode !== "failed",
            sequenceId: 1,
            bitmap,
            durationMs: 1,
          };
        });
      await renderCurrentFrame(ctx);
      expect(request).toHaveBeenCalledOnce();
      expect(commitAssets).toHaveBeenCalledTimes(commits);
      expect(commitModel).not.toHaveBeenCalled();
      expect(healthy).not.toHaveBeenCalled();
      expect(draw).not.toHaveBeenCalled();
      expect(close).toHaveBeenCalledOnce();
      expect(ctx.state.staleResponses).toBe(stale);
      expect(ctx.state.renderInFlight).toBe(false);
      expect(idle).toHaveBeenCalledOnce();
    },
  );
});
