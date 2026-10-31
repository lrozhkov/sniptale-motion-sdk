import { describe, expect, it, vi } from "vitest";

import { mergePrimitiveBounds } from "../src/apps/viewer/rendering/contract-bounds";
import { createEmptyBindingReads } from "../src/apps/viewer/app/binding-reads";
import {
  createRendererContractCoverageActions,
  waitForContractSampleSlot,
} from "../src/apps/viewer/rendering/contract-coverage";

describe("viewer renderer contract coverage scheduling", () => {
  it("backs off while playback owns the renderer", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", {
      setTimeout: globalThis.setTimeout,
    });
    const ctx = createContext({ playing: true });
    try {
      const slot = waitForContractSampleSlot(ctx, "effect", 2);
      await vi.advanceTimersByTimeAsync(249);
      expect(ctx.waitForRenderIdle).not.toHaveBeenCalled();
      ctx.state.playing = false;
      await vi.advanceTimersByTimeAsync(1);
      await expect(slot).resolves.toBe(true);
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it("waits on render completion without polling", async () => {
    const ctx = createContext({ renderInFlight: true });
    ctx.waitForRenderIdle.mockImplementation(async () => {
      ctx.state.renderInFlight = false;
    });

    await expect(waitForContractSampleSlot(ctx, "effect", 2)).resolves.toBe(
      true,
    );
    expect(ctx.waitForRenderIdle).toHaveBeenCalledOnce();
  });
});

describe("renderer contract sample ownership", () => {
  it.each([
    "current",
    "restarted",
    "changed-template",
    "replaced-source",
    "revised-model",
    "commit-error",
  ] as const)(
    "handles %s sample responses and releases bitmaps",
    async (mode) => {
      vi.stubGlobal("window", { setTimeout: globalThis.setTimeout });
      const ctx = createContext({});
      const template = { id: "effect", duration: 2, moduleId: "module" };
      const reads = createEmptyBindingReads();
      const bitmap = { close: vi.fn() };
      let snapshot = {
        ...template,
        layers: [],
        clips: [],
        scenes: [],
        timeline: { phases: [], tracks: [] },
      };
      Object.assign(ctx.state, {
        currentTemplate: template,
        loadedModules: new Set(["module"]),
        rendererContractReads: reads,
        lastBindingReads: reads,
        controls: {},
      });
      Object.assign(ctx, {
        deps: {
          createEmptyBindingReads,
          normalizeBindingReads: () => reads,
          createRequestId: () => "sample",
        },
        refs: {
          canvas: { width: 1280, height: 720 },
          fpsInput: { value: "30" },
        },
        renderValidationPanel: vi.fn(),
        updateExportAvailability: vi.fn(),
        renderRendererBindingsPanel: vi.fn(),
        getRenderTemplateSnapshot: () => snapshot,
        getContractRenderSize: () => ({ width: 320, height: 180 }),
        buildRendererBindingCoverage: () => ({ unboundCount: 1 }),
        createRenderInputFrames: async () => ({ frames: {}, transfer: [] }),
        createRenderAssets: async () => ({ envelope: {}, transfer: [] }),
        createRenderModelEnvelope: () => ({}),
        getRendererType: () => "effect-v1",
        normalizePreviewBindingReads: () => reads,
        commitRenderAssetTransfers: vi.fn(() => {
          if (mode === "commit-error") throw new Error("commit failed");
        }),
        commitRenderModelEnvelope: vi.fn(),
        requestSandbox: vi.fn(async () => {
          if (mode === "restarted") ctx.state.sandboxRuntimeGeneration++;
          if (mode === "changed-template")
            ctx.state.currentTemplate = { ...template, id: "other" };
          if (mode === "replaced-source")
            ctx.state.currentTemplate = { ...template };
          if (mode === "revised-model") snapshot = { ...snapshot };
          return { ok: true, bitmap, bindingReads: reads };
        }),
        ...createRendererContractCoverageActions(() => ctx),
      });
      ctx.createRendererContractSampleTimes = () => [0];
      try {
        if (mode === "commit-error") {
          await expect(
            ctx.refreshRendererContractCoverage(template),
          ).rejects.toThrow("commit failed");
        } else {
          await ctx.refreshRendererContractCoverage(template);
          expect(ctx.commitRenderAssetTransfers).toHaveBeenCalledTimes(
            mode === "current" ? 1 : 0,
          );
          expect(ctx.commitRenderModelEnvelope).toHaveBeenCalledTimes(
            mode === "current" ? 1 : 0,
          );
          expect(ctx.state.rendererContractCoverageReady).toBe(
            mode === "current",
          );
        }
        expect(bitmap.close).toHaveBeenCalledOnce();
        expect(ctx.state.rendererContractRefreshing).toBe(false);
        expect(ctx.state.rendererContractRefreshPromise).toBeNull();
        expect(ctx.state.rendererContractRefreshTemplate).toBeNull();
      } finally {
        vi.unstubAllGlobals();
      }
    },
  );
});

describe("viewer renderer contract bounds", () => {
  it("unions samples per layer and returns stable layer order", () => {
    expect(
      mergePrimitiveBounds(
        [{ height: 20, layerId: "title", width: 40, x: 10, y: 15 }],
        [
          { height: 10, layerId: "logo", width: 10, x: 5, y: 5 },
          { height: 30, layerId: "title", width: 20, x: 0, y: 10 },
          { height: 1, width: 1, x: 0, y: 0 },
        ],
      ),
    ).toEqual([
      { height: 10, layerId: "logo", width: 10, x: 5, y: 5 },
      { height: 30, layerId: "title", width: 50, x: 0, y: 10 },
    ]);
  });
});

function createContext(state: Record<string, unknown>) {
  return {
    state: {
      currentTemplate: { id: "effect" },
      playing: false,
      renderInFlight: false,
      renderQueued: false,
      sandboxReady: true,
      sandboxRecoveryPending: false,
      sandboxRuntimeGeneration: 2,
      ...state,
    },
    waitForRenderIdle: vi.fn(),
  } as any;
}
