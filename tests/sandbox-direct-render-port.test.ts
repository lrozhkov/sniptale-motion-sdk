import {
  createNativeCanvasFixture,
  createNativePortFixture,
} from "./helpers/native-render-fixtures.js";
import { parseSandboxRuntimeMessage } from "../src/apps/sandbox/runtime/message-boundary.js";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createWorkerRuntimeMessageHandler,
  parseDirectRenderPortConnection,
} from "../src/apps/sandbox/runtime/direct-render-port";

describe("sandbox direct render response port", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  it("accepts only bounded port connection payloads", () => {
    const port = createNativePortFixture({
      addEventListener: vi.fn<MessagePort["addEventListener"]>(),
      postMessage: vi.fn<MessagePort["postMessage"]>(),
    });
    const presentationSurface = createNativeCanvasFixture({
      getContext: vi.fn<OffscreenCanvas["getContext"]>(),
      height: 90,
      width: 160,
    });
    expect(
      parseDirectRenderPortConnection({
        kind: "connectDirectRenderPort",
        port,
      }),
    ).toEqual({ kind: "connectDirectRenderPort", port });
    expect(
      parseDirectRenderPortConnection({
        kind: "connectDirectRenderPort",
        port,
        presentationSurface,
      }),
    ).toEqual({
      kind: "connectDirectRenderPort",
      port,
      presentationSurface,
    });
    expect(
      parseDirectRenderPortConnection({
        kind: "connectDirectRenderPort",
        port: {},
      }),
    ).toBeNull();
    expect(
      parseDirectRenderPortConnection({
        kind: "connectDirectRenderPort",
        port,
        presentationSurface: { height: 0, width: 160 },
      }),
    ).toBeNull();
  });

  it("rejects structural port and canvas impostors", () => {
    expect(
      parseDirectRenderPortConnection({
        kind: "connectDirectRenderPort",
        port: {
          addEventListener: vi.fn<MessagePort["addEventListener"]>(),
          postMessage: vi.fn<MessagePort["postMessage"]>(),
        },
      }),
    ).toBeNull();
    expect(
      parseDirectRenderPortConnection({
        kind: "connectDirectRenderPort",
        port: createNativePortFixture(),
        presentationSurface: {
          width: 160,
          height: 90,
          getContext: vi.fn<OffscreenCanvas["getContext"]>(),
        },
      }),
    ).toBeNull();
  });

  it("sends opted-in worker frame results through the port and acknowledges settlement", async () => {
    const fallbackPost = vi.fn<WorkerOptions["fallbackPost"]>();
    const portPost =
      vi.fn<(message: unknown, transfer?: Transferable[]) => void>();
    const portListener: {
      current: ((event: MessageEvent<unknown>) => void) | null;
    } = { current: null };
    const port = createNativePortFixture({
      addEventListener: (
        _type: string,
        listener: (event: MessageEvent<unknown>) => void,
      ) => {
        portListener.current = listener;
      },
      close: vi.fn<MessagePort["close"]>(),
      postMessage: portPost,
      start: vi.fn<MessagePort["start"]>(),
    });
    const handleMessage = vi.fn<WorkerOptions["session"]["handleMessage"]>(
      async (message, responseSink) => {
        if (message.kind !== "renderFrame")
          throw new Error("Unexpected worker request kind.");
        if (!responseSink) throw new Error("Missing worker response sink.");
        responseSink(
          {
            kind: "renderFrameProgress",
            phase: "preview-cache-store",
            requestId: message.requestId,
            sequenceId: message.sequenceId,
          },
          [],
        );
        responseSink(
          {
            kind: "renderFrameResult",
            requestId: message.requestId,
            sequenceId: message.sequenceId,
            durationMs: 0,
            ok: true,
          },
          [],
        );
      },
    );
    const onPresentationSurface =
      vi.fn<NonNullable<WorkerOptions["onPresentationSurface"]>>();
    const presentationSurface = createNativeCanvasFixture({
      getContext: vi.fn<OffscreenCanvas["getContext"]>(),
      height: 90,
      width: 160,
    });
    const handler = createWorkerRuntimeMessageHandler({
      fallbackPost,
      onPresentationSurface,
      parseMessage: parseSandboxRuntimeMessage,
      session: { handleMessage },
    });
    handler(
      new MessageEvent<unknown>("message", {
        data: { kind: "connectDirectRenderPort", port, presentationSurface },
      }),
    );
    expect(onPresentationSurface).toHaveBeenCalledWith(presentationSurface);
    handler(
      new MessageEvent<unknown>("message", {
        data: {
          directResponse: true,
          effectId: "effect",
          height: 90,
          kind: "renderFrame",
          renderQuality: "full",
          requestId: "frame:1",
          sequenceId: 1,
          width: 160,
        },
      }),
    );
    await vi.waitFor(() => expect(portPost).toHaveBeenCalledTimes(2));
    expect(fallbackPost).toHaveBeenCalledTimes(1);
    expect(fallbackPost).toHaveBeenCalledWith({
      kind: "directRenderSettled",
      requestId: "frame:1",
    });

    if (!portListener.current)
      throw new Error("Direct port listener was not registered.");
    portListener.current(
      new MessageEvent<unknown>("message", {
        data: {
          effectId: "effect",
          height: 90,
          kind: "renderFrame",
          renderQuality: "full",
          requestId: "frame:2",
          sequenceId: 2,
          width: 160,
        },
      }),
    );
    await vi.waitFor(() => expect(portPost).toHaveBeenCalledTimes(4));
    expect(portPost).toHaveBeenLastCalledWith(
      {
        kind: "renderFrameResult",
        requestId: "frame:2",
        sequenceId: 2,
        durationMs: 0,
        ok: true,
      },
      [],
    );
    expect(fallbackPost).toHaveBeenCalledWith({
      kind: "directRenderSettled",
      requestId: "frame:2",
    });
    expect(fallbackPost).toHaveBeenCalledWith({
      kind: "directRenderStarted",
      previewCacheEnabled: false,
      requestId: "frame:2",
      sequenceId: 2,
    });
  });
});

type WorkerOptions = Parameters<typeof createWorkerRuntimeMessageHandler>[0];
