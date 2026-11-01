import {
  createNativeBitmapFixture,
  createNativeCanvasFixture,
  createNativePortFixture,
} from "./helpers/native-render-fixtures.js";
import type { SandboxRuntimeMessage } from "../src/apps/sandbox/runtime/message-boundary.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  collectRenderTransferables,
  createSandboxExecutionRouter,
  prepareWorkerRenderMessage,
} from "../src/apps/sandbox/runtime/execution-router";

type RouterOptions = Parameters<typeof createSandboxExecutionRouter>[0];
type ForegroundSession = ReturnType<RouterOptions["createForegroundSession"]>;

function createWorkerHarness() {
  class FixtureWorker extends EventTarget {
    postMessage(_message: unknown, _transfer?: Transferable[]): void {}
    terminate(): void {}
  }
  vi.stubGlobal("Worker", FixtureWorker);
  const nativeWorker = new Worker("fixture-worker");
  const worker = Object.assign(nativeWorker, {
    postMessage: vi.spyOn(nativeWorker, "postMessage"),
    terminate: vi.spyOn(nativeWorker, "terminate"),
  });
  return {
    emit(type: "message" | "error", data?: unknown) {
      worker.dispatchEvent(
        type === "message"
          ? new MessageEvent<unknown>("message", { data })
          : new Event("error"),
      );
    },
    worker,
  };
}

function createLoadMessage(): Extract<
  SandboxRuntimeMessage,
  { kind: "loadEffectDocument" }
> {
  return {
    document: {
      assets: [],
      clips: [],
      controls: [],
      duration: 1,
      id: "effect-a",
      kind: "standalone",
      label: { ru: "Тест", en: "Test" },
      layers: [],
      program: { commands: [], kind: "graph", version: 1 },
      scenes: [{ id: "main", start: 0, duration: 1 }],
      schemaVersion: "sniptale.effect.v1",
      timeline: { phases: [], tracks: [] },
    },
    kind: "loadEffectDocument",
    moduleId: "canvas-module",
    requestId: "load:1",
  };
}

describe("sandbox execution router", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("routes declarative graph documents through the worker and transfers frames", async () => {
    const harness = createWorkerHarness();
    const foregroundHandle = vi.fn<() => Promise<undefined>>(
      async () => undefined,
    );
    const postToParent = vi.fn<RouterOptions["postToParent"]>();
    const router = createSandboxExecutionRouter({
      createForegroundSession: () => ({ handleMessage: foregroundHandle }),
      createWorker: () => harness.worker,
      postToParent,
    });

    const load = createLoadMessage();
    await router.handleMessage(load);
    expect(harness.worker.postMessage).toHaveBeenCalledWith(load);
    expect(foregroundHandle).not.toHaveBeenCalled();

    harness.emit("message", {
      compositionIds: ["canvas-composition"],
      effectIds: [],
      kind: "loadEffectDocumentResult",
      moduleId: "canvas-module",
      ok: true,
      requestId: "load:1",
    });
    expect(router.usingWorkerFor("canvas-composition")).toBe(true);
    expect(postToParent).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "loadEffectDocumentResult", ok: true }),
      [],
    );

    const bitmap = createNativeBitmapFixture();
    const frame = {
      assets: { logo: { bitmap } },
      effectId: "canvas-composition",
      height: 180,
      kind: "renderFrame" as const,
      renderQuality: "reduced" as const,
      requestId: "frame:1",
      sequenceId: 1,
      width: 320,
    };
    await router.handleMessage(frame);
    expect(harness.worker.postMessage).toHaveBeenLastCalledWith(frame, [
      bitmap,
    ]);
  });

  it("attaches a direct response port and settles its worker request", async () => {
    const harness = createWorkerHarness();
    const postToParent = vi.fn<RouterOptions["postToParent"]>();
    const router = createSandboxExecutionRouter({
      createForegroundSession: () => ({
        handleMessage: vi
          .fn<ForegroundSession["handleMessage"]>()
          .mockResolvedValue(),
      }),
      createWorker: () => harness.worker,
      postToParent,
    });
    const port = createNativePortFixture({ close: vi.fn<() => void>() });
    const presentationSurface = createNativeCanvasFixture({
      width: 160,
      height: 90,
    });
    expect(router.connectDirectRenderPort(port, presentationSurface)).toBe(
      true,
    );
    await router.handleMessage(createLoadMessage());
    expect(harness.worker.postMessage).toHaveBeenCalledWith(
      { kind: "connectDirectRenderPort", port, presentationSurface },
      [port, presentationSurface],
    );
    harness.emit("message", {
      compositionIds: ["canvas-composition"],
      effectIds: [],
      kind: "loadEffectDocumentResult",
      moduleId: "canvas-module",
      ok: true,
      requestId: "load:1",
    });
    await router.handleMessage({
      effectId: "canvas-composition",
      height: 90,
      kind: "renderFrame",
      renderQuality: "reduced",
      requestId: "frame:direct",
      sequenceId: 2,
      width: 160,
    });
    expect(harness.worker.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ directResponse: true }),
      [],
    );
    harness.emit("message", {
      kind: "directRenderSettled",
      requestId: "frame:direct",
    });
    harness.emit("error", new Error("after settlement"));
    expect(postToParent).not.toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "frame:direct" }),
    );
  });

  it("falls back to the foreground when a worker fails during module load", async () => {
    const harness = createWorkerHarness();
    const foregroundHandle = vi.fn<() => Promise<undefined>>(
      async () => undefined,
    );
    const router = createSandboxExecutionRouter({
      createForegroundSession: () => ({ handleMessage: foregroundHandle }),
      createWorker: () => harness.worker,
      postToParent: vi.fn<RouterOptions["postToParent"]>(),
    });
    const load = createLoadMessage();
    await router.handleMessage(load);

    harness.emit("error", new Error("worker failed"));
    await vi.waitFor(() => expect(foregroundHandle).toHaveBeenCalledWith(load));
    expect(harness.worker.terminate).toHaveBeenCalledOnce();
  });

  it("settles pending frames and restarts on a worker runtime failure", async () => {
    const harness = createWorkerHarness();
    const postToParent = vi.fn<RouterOptions["postToParent"]>();
    const router = createSandboxExecutionRouter({
      createForegroundSession: () => ({
        handleMessage: vi
          .fn<ForegroundSession["handleMessage"]>()
          .mockResolvedValue(),
      }),
      createWorker: () => harness.worker,
      postToParent,
    });
    await router.handleMessage(createLoadMessage());
    harness.emit("message", {
      compositionIds: ["canvas-composition"],
      effectIds: [],
      kind: "loadEffectDocumentResult",
      moduleId: "canvas-module",
      ok: true,
      requestId: "load:1",
    });
    await router.handleMessage({
      effectId: "canvas-composition",
      height: 180,
      kind: "renderFrame",
      renderQuality: "reduced",
      requestId: "frame:1",
      sequenceId: 7,
      width: 320,
    });

    harness.emit("message", {
      kind: "renderFrameProgress",
      phase: "preview-cache-store",
      requestId: "frame:1",
      sequenceId: 7,
    });

    harness.emit("error", new Error("worker failed"));

    expect(postToParent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "renderFrameProgress",
        requestId: "frame:1",
      }),
    );
    expect(postToParent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "renderFrameResult",
        ok: false,
        requestId: "frame:1",
        sequenceId: 7,
      }),
    );
    expect(postToParent).toHaveBeenCalledWith({ kind: "runtimeReady" });
  });

  it("settles a frame when worker payload preparation fails", async () => {
    const harness = createWorkerHarness();
    const postToParent = vi.fn<RouterOptions["postToParent"]>();
    const router = createSandboxExecutionRouter({
      createForegroundSession: () => ({
        handleMessage: vi
          .fn<ForegroundSession["handleMessage"]>()
          .mockResolvedValue(),
      }),
      createWorker: () => harness.worker,
      postToParent,
    });
    await router.handleMessage(createLoadMessage());
    harness.emit("message", {
      compositionIds: ["canvas-composition"],
      effectIds: [],
      kind: "loadEffectDocumentResult",
      moduleId: "canvas-module",
      ok: true,
      requestId: "load:1",
    });
    const bitmap = createNativeBitmapFixture({ height: 32, width: 32 });
    const close = vi.spyOn(bitmap, "close");

    await router.handleMessage({
      assets: {
        logo: {
          bitmap,
          cacheKey: "logo-v1",
          id: "logo",
          svgText: "not valid svg",
        },
      },
      effectId: "canvas-composition",
      height: 180,
      kind: "renderFrame",
      renderQuality: "reduced",
      requestId: "frame:invalid-svg",
      sequenceId: 8,
      width: 320,
    });

    expect(close).toHaveBeenCalledOnce();
    expect(postToParent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "renderFrameResult",
        ok: false,
        requestId: "frame:invalid-svg",
      }),
    );
  });

  it("keeps cache preparation alive outside a blocked render worker", async () => {
    vi.useFakeTimers();
    const harness = createWorkerHarness();
    const postToParent = vi.fn<RouterOptions["postToParent"]>();
    const router = createSandboxExecutionRouter({
      createForegroundSession: () => ({
        handleMessage: vi
          .fn<ForegroundSession["handleMessage"]>()
          .mockResolvedValue(),
      }),
      createWorker: () => harness.worker,
      postToParent,
    });
    await router.handleMessage(createLoadMessage());
    harness.emit("message", {
      compositionIds: ["canvas-composition"],
      effectIds: [],
      kind: "loadEffectDocumentResult",
      moduleId: "canvas-module",
      ok: true,
      requestId: "load:1",
    });
    await router.handleMessage({
      effectId: "canvas-composition",
      height: 180,
      kind: "renderFrame",
      previewCacheEnabled: true,
      renderQuality: "full",
      requestId: "frame:cached",
      sequenceId: 11,
      width: 320,
    });

    await vi.advanceTimersByTimeAsync(260);
    expect(postToParent).toHaveBeenLastCalledWith({
      kind: "renderFrameProgress",
      phase: "rendering",
      requestId: "frame:cached",
      sequenceId: 11,
    });

    harness.emit("message", {
      bitmap: createNativeBitmapFixture(),
      durationMs: 20,
      kind: "renderFrameResult",
      ok: true,
      requestId: "frame:cached",
      sequenceId: 11,
    });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(
      postToParent.mock.calls.filter(
        ([message]) =>
          message !== null &&
          typeof message === "object" &&
          "kind" in message &&
          message.kind === "renderFrameProgress",
      ),
    ).toHaveLength(1);
  });

  it("relays progress for a cache render sent over the direct worker port", async () => {
    vi.useFakeTimers();
    const harness = createWorkerHarness();
    const postToParent = vi.fn<RouterOptions["postToParent"]>();
    const router = createSandboxExecutionRouter({
      createForegroundSession: () => ({
        handleMessage: vi
          .fn<ForegroundSession["handleMessage"]>()
          .mockResolvedValue(),
      }),
      createWorker: () => harness.worker,
      postToParent,
    });
    await router.handleMessage(createLoadMessage());
    harness.emit("message", {
      kind: "directRenderStarted",
      previewCacheEnabled: true,
      requestId: "frame:direct-cached",
      sequenceId: 12,
    });

    await vi.advanceTimersByTimeAsync(260);
    expect(postToParent).toHaveBeenCalledWith({
      kind: "renderFrameProgress",
      phase: "rendering",
      requestId: "frame:direct-cached",
      sequenceId: 12,
    });
  });
});

describe("sandbox render transferables", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("preserves an id-only asset envelope for the worker cache", () => {
    expect(
      prepareWorkerRenderMessage({
        effectId: "effect-a",
        renderAssetsId: "render-assets-1",
      }),
    ).toEqual({
      effectId: "effect-a",
      renderAssetsId: "render-assets-1",
    });
  });

  it("rejects non-transferable bitmap impostors before posting", () => {
    expect(() =>
      collectRenderTransferables({
        assets: {
          a: { bitmap: { width: 1, height: 1, close: vi.fn<() => void>() } },
        },
      }),
    ).toThrow("native ImageBitmap");
    expect(() =>
      collectRenderTransferables({ inputFrames: { source: {} } }),
    ).toThrow("native ImageBitmap");
  });

  it("deduplicates transferred asset and input frame bitmaps", () => {
    const asset = createNativeBitmapFixture();
    const frame = createNativeBitmapFixture();
    expect(
      collectRenderTransferables({
        assets: { a: { bitmap: asset }, b: { bitmap: asset } },
        inputFrames: { next: { bitmap: frame }, previous: frame },
      }),
    ).toEqual([asset, frame]);
  });
});
