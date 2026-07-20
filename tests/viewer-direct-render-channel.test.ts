import { afterEach, describe, expect, it, vi } from "vitest";

import {
  connectDirectRenderResponseChannel,
  prepareDirectPresentationCanvas,
} from "../src/apps/viewer/transport/direct-render-channel";

const previousWindow = globalThis.window;

afterEach(() => {
  Object.assign(globalThis, { window: previousWindow });
});

describe("viewer direct render channel", () => {
  it("replaces a presentation canvas transferred to an old worker", () => {
    const replacement = { height: 0, width: 0 };
    const canvas = {
      cloneNode: vi.fn(() => replacement),
      replaceWith: vi.fn(),
      set height(_value: number) {
        throw new DOMException("already transferred", "InvalidStateError");
      },
      set width(_value: number) {
        throw new DOMException("already transferred", "InvalidStateError");
      },
    } as unknown as HTMLCanvasElement;

    expect(prepareDirectPresentationCanvas(canvas, 1280, 720)).toBe(
      replacement,
    );
    expect(replacement).toEqual({ height: 720, width: 1280 });
    expect(canvas.replaceWith).toHaveBeenCalledWith(replacement);
  });

  it("connects the response port with a transferable presentation surface", () => {
    const listeners = new Map<string, (event: MessageEvent) => void>();
    const port1 = {
      addEventListener: vi.fn((type: string, listener: any) =>
        listeners.set(type, listener),
      ),
      close: vi.fn(),
      postMessage: vi.fn(),
      start: vi.fn(),
    };
    const port2 = { close: vi.fn() };
    const surface = { height: 90, width: 160 };
    const target = { postMessage: vi.fn() };
    const onMessage = vi.fn();
    Object.assign(globalThis, {
      window: { location: { href: "http://viewer.test/index.html" } },
    });

    const connection = connectDirectRenderResponseChannel({
      createChannel: () => ({ port1, port2 }) as unknown as MessageChannel,
      onMessage,
      presentationCanvas: {
        transferControlToOffscreen: vi.fn(() => surface),
      } as unknown as HTMLCanvasElement,
      sandboxFrame: {
        contentWindow: target,
        src: "http://sandbox.test/sandbox.html",
      } as unknown as HTMLIFrameElement,
    });

    expect(connection?.presentationSurfaceAttached).toBe(true);
    expect(target.postMessage).toHaveBeenCalledWith(
      {
        kind: "connectDirectRenderPort",
        port: port2,
        presentationSurface: surface,
      },
      "http://sandbox.test",
      [port2, surface],
    );
    listeners.get("message")?.({ data: { kind: "frame" } } as MessageEvent);
    expect(onMessage).toHaveBeenCalledWith({ kind: "frame" });
  });
});
