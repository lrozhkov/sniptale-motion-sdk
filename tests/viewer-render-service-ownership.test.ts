import { describe, expect, it, vi } from "vitest";
import { renderCurrentFrame } from "../src/apps/viewer/rendering/service";

describe("preview result ownership before cache commits", () => {
  it.each([
    "restarted",
    "replaced",
    "out-of-order",
    "failed",
    "commit-error",
  ] as const)(
    "discards %s results before touching cache authority",
    async (mode) => {
      const template = { id: "effect", duration: 2, moduleId: "module" };
      const bitmap = { close: vi.fn() };
      const ctx = {
        state: {
          currentTemplate: template,
          sandboxReady: true,
          loadedModules: new Set(["module"]),
          frameSequence: 0,
          sandboxRuntimeGeneration: 1,
          staleResponses: 0,
          previewCacheEnabled: false,
        },
        refs: {
          timeSlider: { value: "0" },
          fpsInput: { value: "30" },
          timeOutput: {},
        },
        deps: {
          MAX_RENDER_PIXELS: 1280 * 720,
          clamp: (value: number, min: number, max: number) =>
            Math.min(max, Math.max(min, value)),
          createRequestId: () => "frame",
          t: (_key: string, fallback: string) => fallback,
        },
        setRenderStatus: vi.fn(),
        getRenderTemplateSnapshot: () => ({ duration: 2 }),
        getCompositionDesignSize: () => ({ width: 1280, height: 720 }),
        getPreviewRasterSize: () => ({ width: 1280, height: 720 }),
        getPreviewRenderPlan: () => ({
          width: 1280,
          height: 720,
          scale: 1,
          renderQuality: "full",
        }),
        formatSeconds: () => "0",
        createRenderInputFrames: async () => ({ frames: {}, transfer: [] }),
        createRenderAssets: async () => ({ envelope: {}, transfer: [] }),
        createRenderModelEnvelope: () => ({}),
        shouldUseDirectPreviewSurface: () => false,
        getRendererType: () => "effect-v1",
        commitRenderAssetTransfers: vi.fn(() => {
          if (mode === "commit-error") throw new Error("commit failed");
        }),
        commitRenderModelEnvelope: vi.fn(),
        markSandboxRenderHealthy: vi.fn(),
        drawCompletedFrame: vi.fn(),
        resolveRenderIdleWaiters: vi.fn(),
        logDiagnostic: vi.fn(),
      } as any;
      ctx.requestSandbox = vi.fn(async () => {
        if (mode === "restarted") ctx.state.sandboxRuntimeGeneration++;
        if (mode === "replaced") ctx.state.currentTemplate = { ...template };
        if (mode === "out-of-order") ctx.state.frameSequence++;
        return { ok: mode !== "failed", sequenceId: 1, bitmap, durationMs: 1 };
      });
      await renderCurrentFrame(ctx);
      expect(ctx.requestSandbox).toHaveBeenCalledOnce();
      expect(ctx.commitRenderAssetTransfers).toHaveBeenCalledTimes(
        mode === "commit-error" ? 1 : 0,
      );
      expect(ctx.commitRenderModelEnvelope).not.toHaveBeenCalled();
      expect(ctx.markSandboxRenderHealthy).not.toHaveBeenCalled();
      expect(ctx.drawCompletedFrame).not.toHaveBeenCalled();
      expect(bitmap.close).toHaveBeenCalledOnce();
      expect(ctx.state.staleResponses).toBe(
        mode === "failed" || mode === "commit-error" ? 0 : 1,
      );
      expect(ctx.state.renderInFlight).toBe(false);
      expect(ctx.resolveRenderIdleWaiters).toHaveBeenCalledOnce();
    },
  );
});
