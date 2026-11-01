import { afterEach, describe, expect, it, vi } from "vitest";

import { mergePrimitiveBounds } from "../src/apps/viewer/rendering/contract-bounds";
import { createEmptyBindingReads } from "../src/apps/viewer/app/binding-reads";
import { waitForContractSampleSlot } from "../src/apps/viewer/rendering/contract-coverage";

import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import { createNativeBitmapFixture } from "./helpers/native-render-fixtures.js";
import type { ViewerAppContext } from "../src/apps/viewer/app/context.js";
import type { SandboxRenderResponse } from "../src/apps/viewer/transport/contract.js";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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
    { mode: "current", commits: 1, ready: true },
    { mode: "restarted", commits: 0, ready: false },
    { mode: "changed-template", commits: 0, ready: false },
    { mode: "replaced-source", commits: 0, ready: false },
    { mode: "revised-model", commits: 1, ready: true },
  ] as const)(
    "handles $mode sample responses and releases bitmaps",
    async ({ mode, commits, ready }) => {
      const { ctx, template, close, commitAssets, commitModel } =
        createSampleContext(mode);
      await ctx.refreshRendererContractCoverage(template);
      expect(commitAssets).toHaveBeenCalledTimes(commits);
      expect(commitModel).toHaveBeenCalledTimes(commits);
      expect(ctx.state.rendererContractCoverageReady).toBe(ready);
      expect(close).toHaveBeenCalledTimes(mode === "revised-model" ? 2 : 1);
      expect(ctx.requestSandbox).toHaveBeenCalledTimes(
        mode === "revised-model" ? 2 : 1,
      );
      expect(ctx.state.rendererContractRefreshing).toBe(false);
      expect(ctx.state.rendererContractRefreshPromise).toBeNull();
      expect(ctx.state.rendererContractRefreshTemplate).toBeNull();
    },
  );

  it("shares current-model resampling across concurrent callers", async () => {
    const { ctx, template, close, commitAssets, commitModel } =
      createSampleContext("revised-model");
    await Promise.all([
      ctx.refreshRendererContractCoverage(template),
      ctx.refreshRendererContractCoverage(template),
    ]);
    expect(ctx.requestSandbox).toHaveBeenCalledTimes(2);
    expect(commitAssets).toHaveBeenCalledOnce();
    expect(commitModel).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledTimes(2);
    expect(ctx.state.rendererContractCoverageReady).toBe(true);
    expect(ctx.state.rendererContractRefreshing).toBe(false);
    expect(ctx.state.rendererContractRefreshPromise).toBeNull();
  });

  it("releases the bitmap and refresh ownership when the asset commit fails", async () => {
    const { ctx, template, close, commitAssets, commitModel } =
      createSampleContext("commit-error");
    await expect(ctx.refreshRendererContractCoverage(template)).rejects.toThrow(
      "commit failed",
    );
    expect(commitAssets).toHaveBeenCalledOnce();
    expect(commitModel).not.toHaveBeenCalled();
    expect(ctx.state.rendererContractCoverageReady).toBe(false);
    expect(close).toHaveBeenCalledOnce();
    expect(ctx.state.rendererContractRefreshing).toBe(false);
    expect(ctx.state.rendererContractRefreshPromise).toBeNull();
    expect(ctx.state.rendererContractRefreshTemplate).toBeNull();
  });
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

function createContext(state: Partial<ViewerAppContext["state"]>) {
  const ctx = createViewerContextFixture();
  Object.assign(
    ctx.state,
    {
      currentTemplate: { id: "effect", duration: 2 },
      sandboxReady: true,
      sandboxRuntimeGeneration: 2,
    },
    state,
  );
  vi.stubGlobal("window", { setTimeout: globalThis.setTimeout });
  const waitForRenderIdle = vi
    .spyOn(ctx, "waitForRenderIdle")
    .mockResolvedValue();
  return Object.assign(ctx, { waitForRenderIdle });
}

function createSampleContext(
  mode:
    | "current"
    | "restarted"
    | "changed-template"
    | "replaced-source"
    | "revised-model"
    | "commit-error",
) {
  const ctx = createContext({});
  const template = { id: "effect", duration: 2, moduleId: "module" };
  const reads = createEmptyBindingReads();
  const close = vi.fn<() => void>();
  let revised = false;
  let snapshot = {
    ...template,
    layers: [],
    clips: [],
    scenes: [],
    timeline: { duration: 2, phases: [], tracks: [] },
  };
  ctx.state.currentTemplate = template;
  ctx.state.loadedModules.add("module");
  ctx.state.rendererContractReads = reads;
  ctx.state.lastBindingReads = reads;
  ctx.refs.canvas.width = 1280;
  ctx.refs.canvas.height = 720;
  ctx.refs.fpsInput.value = "30";
  vi.spyOn(ctx.deps, "normalizeBindingReads").mockReturnValue(reads);
  vi.spyOn(ctx.deps, "createRequestId").mockReturnValue("sample");
  vi.spyOn(ctx, "renderValidationPanel").mockImplementation(() => {});
  vi.spyOn(ctx, "updateExportAvailability").mockImplementation(() => {});
  vi.spyOn(ctx, "renderRendererBindingsPanel").mockImplementation(() => {});
  vi.spyOn(ctx, "getRenderTemplateSnapshot").mockImplementation(() => snapshot);
  vi.spyOn(ctx, "getContractRenderSize").mockReturnValue({
    width: 320,
    height: 180,
    scale: 0.25,
  });
  vi.spyOn(ctx, "buildRendererBindingCoverage").mockReturnValue({
    boundCount: 0,
    totalCount: 1,
    unboundCount: 1,
    items: [
      { bound: false, id: "box", label: "Box", sceneId: null, type: "layer" },
    ],
  });
  vi.spyOn(ctx, "createRenderInputFrames").mockResolvedValue({
    frames: {},
    transfer: [],
  });
  vi.spyOn(ctx, "createRenderAssets").mockResolvedValue({
    cacheKeys: [],
    envelope: { renderAssetsId: "sample-assets" },
    transfer: [],
  });
  vi.spyOn(ctx, "createRenderModelEnvelope").mockReturnValue({});
  vi.spyOn(ctx, "getRendererType").mockReturnValue("effect");
  vi.spyOn(ctx, "normalizePreviewBindingReads").mockReturnValue(reads);
  const commitAssets = vi
    .spyOn(ctx, "commitRenderAssetTransfers")
    .mockImplementation(() => {
      if (mode === "commit-error") throw new Error("commit failed");
    });
  const commitModel = vi
    .spyOn(ctx, "commitRenderModelEnvelope")
    .mockImplementation(() => {});
  vi.spyOn(ctx, "requestSandbox").mockImplementation(
    async (): Promise<SandboxRenderResponse> => {
      if (mode === "restarted") ctx.state.sandboxRuntimeGeneration++;
      if (mode === "changed-template")
        ctx.state.currentTemplate = { ...template, id: "other" };
      if (mode === "replaced-source")
        ctx.state.currentTemplate = { ...template };
      if (mode === "revised-model" && !revised) {
        snapshot = { ...snapshot };
        revised = true;
      }
      const bitmap = createNativeBitmapFixture();
      const originalClose = bitmap.close.bind(bitmap);
      vi.spyOn(bitmap, "close").mockImplementation(() => {
        close();
        originalClose();
      });
      return {
        kind: "renderFrameResult",
        requestId: "sample",
        sequenceId: 0,
        durationMs: 0,
        ok: true,
        bitmap,
        bindingReads: reads,
      };
    },
  );
  vi.spyOn(ctx, "createRendererContractSampleTimes").mockReturnValue([0]);
  return { ctx, template, close, commitAssets, commitModel };
}
