import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSandboxParentTransport,
  resolveSandboxParentOrigin,
} from "../src/apps/sandbox/runtime/parent-transport";

describe("sandbox parent transport", () => {
  it("derives only web origins from the embedding referrer", () => {
    expect(resolveSandboxParentOrigin("http://127.0.0.1:4177/editor")).toBe(
      "http://127.0.0.1:4177",
    );
    expect(resolveSandboxParentOrigin("https://editor.example/path")).toBe(
      "https://editor.example",
    );
    expect(resolveSandboxParentOrigin("file:///tmp/viewer.html")).toBeNull();
    expect(resolveSandboxParentOrigin("not a url")).toBeNull();
  });

  it("accepts messages only from the embedding window and origin", () => {
    class FixtureWindow {
      postMessage(): void {}
    }
    vi.stubGlobal("Window", FixtureWindow);
    class FixtureMessageEvent extends Event {
      readonly source: MessageEventSource | null;
      readonly origin: string;
      constructor(type: string, init: MessageEventInit<unknown> = {}) {
        super(type);
        this.source = init.source ?? null;
        this.origin = init.origin ?? "";
      }
    }
    vi.stubGlobal("MessageEvent", FixtureMessageEvent);
    const parentWindow = new Window();
    const postMessage = vi.spyOn(parentWindow, "postMessage");
    const otherWindow = new Window();
    const transport = createSandboxParentTransport(
      parentWindow,
      "http://127.0.0.1:4177/editor",
    );

    expect(
      transport.accepts(
        new MessageEvent<unknown>("message", {
          origin: "http://127.0.0.1:4177",
          source: parentWindow,
        }),
      ),
    ).toBe(true);
    expect(
      transport.accepts(
        new MessageEvent<unknown>("message", {
          origin: "http://attacker.example",
          source: parentWindow,
        }),
      ),
    ).toBe(false);
    expect(
      transport.accepts(
        new MessageEvent<unknown>("message", {
          origin: "http://127.0.0.1:4177",
          source: otherWindow,
        }),
      ),
    ).toBe(false);

    transport.post({ kind: "runtimeReady" });
    expect(postMessage).toHaveBeenCalledWith(
      { kind: "runtimeReady" },
      "http://127.0.0.1:4177",
      [],
    );
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
