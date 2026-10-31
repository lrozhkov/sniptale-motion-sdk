import {
  createNativeCanvasFixture,
  createNativePortFixture,
} from "./helpers/native-render-fixtures.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createWorkerRuntimeMessageHandler,
  parseDirectRenderPortConnection,
} from "../src/apps/sandbox/runtime/direct-render-port";

describe("sandbox direct render response port", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("accepts only bounded port connection payloads", () => {
    const port = createNativePortFixture({
      addEventListener: vi.fn(),
      postMessage: vi.fn(),
    });
    const presentationSurface = createNativeCanvasFixture({
      getContext: vi.fn(),
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
        port: { addEventListener: vi.fn(), postMessage: vi.fn() },
      }),
    ).toBeNull();
    expect(
      parseDirectRenderPortConnection({
        kind: "connectDirectRenderPort",
        port: createNativePortFixture(),
        presentationSurface: { width: 160, height: 90, getContext: vi.fn() },
      }),
    ).toBeNull();
  });

  it("sends opted-in worker frame results through the port and acknowledges settlement", async () => {
    const fallbackPost = vi.fn();
    const portListener: {
      current: ((event: MessageEvent<unknown>) => void) | null;
    } = { current: null };
    const port = createNativePortFixture({
      addEventListener: vi.fn((_type, listener) => {
        portListener.current = listener;
      }),
      close: vi.fn(),
      postMessage: vi.fn(),
      start: vi.fn(),
    });
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
    const presentationSurface = createNativeCanvasFixture({
      getContext: vi.fn(),
      height: 90,
      width: 160,
    });
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

    portListener.current?.({
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
