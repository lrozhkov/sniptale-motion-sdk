import { afterEach, describe, expect, it, vi } from "vitest";
import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import { createNativeCanvasFixture } from "./helpers/native-render-fixtures.js";
import {
  connectDirectRenderResponseChannel,
  prepareDirectPresentationCanvas,
} from "../src/apps/viewer/transport/direct-render-channel";

const channels: MessageChannel[] = [];
afterEach(() => {
  for (const channel of channels.splice(0)) {
    channel.port1.close();
    channel.port2.close();
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("viewer direct render channel", () => {
  it("replaces a presentation canvas transferred to an old worker", () => {
    const ctx = createViewerContextFixture();
    const replacement = ctx.refs.fastPreviewCanvas;
    replacement.width = 0;
    replacement.height = 0;
    const replaceWith = vi.fn<HTMLCanvasElement["replaceWith"]>();
    const canvas = Object.assign(ctx.refs.canvas, {
      cloneNode: () => replacement,
      replaceWith,
    });
    Object.defineProperties(canvas, {
      height: {
        set() {
          throw new DOMException("already transferred", "InvalidStateError");
        },
      },
      width: {
        set() {
          throw new DOMException("already transferred", "InvalidStateError");
        },
      },
    });
    expect(prepareDirectPresentationCanvas(canvas, 1280, 720)).toBe(
      replacement,
    );
    expect(replacement).toMatchObject({ height: 720, width: 1280 });
    expect(replaceWith).toHaveBeenCalledWith(replacement);
  });

  it("connects the response port with a transferable presentation surface", () => {
    const ctx = createViewerContextFixture();
    const channel = new MessageChannel();
    channels.push(channel);
    const surface = createNativeCanvasFixture({ height: 90, width: 160 });
    class FixtureWindow {
      location = { href: "http://viewer.test/index.html" };
      postMessage(): void {}
    }
    vi.stubGlobal("Window", FixtureWindow);
    const target = new Window();
    const postMessage = vi.spyOn(target, "postMessage");
    vi.stubGlobal("window", target);
    const onMessage = vi.fn<(value: unknown) => void>();
    Object.assign(ctx.refs.canvas, {
      transferControlToOffscreen: () => surface,
    });
    Object.defineProperty(ctx.refs.sandboxFrame, "contentWindow", {
      value: target,
    });
    ctx.refs.sandboxFrame.src = "http://sandbox.test/sandbox.html";
    const connection = connectDirectRenderResponseChannel({
      createChannel: () => channel,
      onMessage,
      presentationCanvas: ctx.refs.canvas,
      sandboxFrame: ctx.refs.sandboxFrame,
    });
    if (!connection)
      throw new Error("Direct response channel was not connected.");
    expect(connection.presentationSurfaceAttached).toBe(true);
    expect(postMessage).toHaveBeenCalledWith(
      {
        kind: "connectDirectRenderPort",
        port: channel.port2,
        presentationSurface: surface,
      },
      "http://sandbox.test",
      [channel.port2, surface],
    );
    channel.port1.dispatchEvent(
      new MessageEvent<unknown>("message", { data: { kind: "frame" } }),
    );
    expect(onMessage).toHaveBeenCalledWith({ kind: "frame" });
  });
});
