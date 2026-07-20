import { describe, expect, it, vi } from "vitest";

import {
  createWorkerRuntimeMessageHandler,
  parseDirectRenderPortConnection,
} from "../src/apps/sandbox/runtime/direct-render-port";

describe("sandbox direct render response port", () => {
  it("accepts only bounded port connection payloads", () => {
    const port = { addEventListener: vi.fn(), postMessage: vi.fn() };
    const presentationSurface = {
      getContext: vi.fn(),
      height: 90,
      width: 160,
    };
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

  it("sends opted-in worker frame results through the port and acknowledges settlement", async () => {
    const fallbackPost = vi.fn();
    let portMessageListener: ((event: MessageEvent) => void) | null = null;
    const port = {
      addEventListener: vi.fn((_type, listener) => {
        portMessageListener = listener;
      }),
      close: vi.fn(),
      postMessage: vi.fn(),
      start: vi.fn(),
    };
    const handleMessage = vi.fn(async (_message, responseSink) => {
      responseSink(
        {
          kind: "renderFrameProgress",
          phase: "preview-cache-store",
          requestId: "frame:1",
          sequenceId: 1,
        },
        [],
      );
      responseSink({ kind: "renderFrameResult", requestId: "frame:1" }, []);
    });
    const onPresentationSurface = vi.fn();
    const presentationSurface = {
      getContext: vi.fn(),
      height: 90,
      width: 160,
    };
    const handler = createWorkerRuntimeMessageHandler({
      fallbackPost,
      onPresentationSurface,
      parseMessage: (value: any) => value,
      session: { handleMessage },
    });
    handler({
      data: { kind: "connectDirectRenderPort", port, presentationSurface },
    } as MessageEvent);
    expect(onPresentationSurface).toHaveBeenCalledWith(presentationSurface);
    handler({
      data: {
        directResponse: true,
        effectId: "effect",
        height: 90,
        kind: "renderFrame",
        requestId: "frame:1",
        sequenceId: 1,
        width: 160,
      },
    } as MessageEvent);
    await vi.waitFor(() => expect(port.postMessage).toHaveBeenCalledTimes(2));
    expect(fallbackPost).toHaveBeenCalledTimes(1);
    expect(fallbackPost).toHaveBeenCalledWith({
      kind: "directRenderSettled",
      requestId: "frame:1",
    });

    portMessageListener?.({
      data: {
        effectId: "effect",
        height: 90,
        kind: "renderFrame",
        requestId: "frame:2",
        sequenceId: 2,
        width: 160,
      },
    } as MessageEvent);
    await vi.waitFor(() => expect(port.postMessage).toHaveBeenCalledTimes(4));
    expect(fallbackPost).toHaveBeenCalledWith({
      kind: "directRenderStarted",
      previewCacheEnabled: false,
      requestId: "frame:2",
      sequenceId: 2,
    });
  });
});
