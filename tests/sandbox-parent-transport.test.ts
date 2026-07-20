import { describe, expect, it, vi } from "vitest";

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
    const parentWindow = { postMessage: vi.fn() } as unknown as Window;
    const otherWindow = {} as Window;
    const transport = createSandboxParentTransport(
      parentWindow,
      "http://127.0.0.1:4177/editor",
    );

    expect(
      transport.accepts({
        origin: "http://127.0.0.1:4177",
        source: parentWindow,
      } as MessageEvent),
    ).toBe(true);
    expect(
      transport.accepts({
        origin: "http://attacker.example",
        source: parentWindow,
      } as MessageEvent),
    ).toBe(false);
    expect(
      transport.accepts({
        origin: "http://127.0.0.1:4177",
        source: otherWindow,
      } as MessageEvent),
    ).toBe(false);

    transport.post({ kind: "runtimeReady" });
    expect(parentWindow.postMessage).toHaveBeenCalledWith(
      { kind: "runtimeReady" },
      "http://127.0.0.1:4177",
      [],
    );
  });
});
