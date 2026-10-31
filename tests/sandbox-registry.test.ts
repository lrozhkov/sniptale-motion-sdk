import { createRenderContext } from "../src/apps/sandbox/runtime/render-context.js";
import { describe, expect, it, vi } from "vitest";

import { createSandboxRegistry } from "../src/apps/sandbox/runtime/registry";

describe("sandbox registry", () => {
  it("registers effects and compositions and disposes owned state", () => {
    const registry = createSandboxRegistry();
    const dispose = vi.fn(() => {
      throw new Error("ignored");
    });
    const renderFrame = vi.fn();

    expect(() => registry.registerEffect({ id: "bad" })).toThrow(
      "registerEffect expects an id and renderFrame(ctx).",
    );
    expect(() =>
      registry.registerComposition({ id: "bad", renderFrame: null }),
    ).toThrow("registerComposition expects an id and renderFrame(ctx).");

    registry.loadedModules.set("module", true);
    registry.registerEffect({ dispose, id: "effect", renderFrame });
    registry.registerComposition({ id: "composition", renderFrame });

    expect(registry.getEffectIds()).toEqual(["effect"]);
    expect(registry.getCompositionIds()).toEqual(["composition"]);
    expect(registry.getRenderer("effect")).toMatchObject({ id: "effect" });
    expect(registry.getRenderer("composition")).toMatchObject({
      id: "composition",
      kind: "composition",
    });

    registry.disposeAll();

    expect(dispose).toHaveBeenCalledOnce();
    expect(registry.getEffectIds()).toEqual([]);
    expect(registry.getCompositionIds()).toEqual([]);
    expect(registry.loadedModules.size).toBe(0);
  });
  it("replaces a renderer across effect kinds and disposes both kinds", () => {
    const registry = createSandboxRegistry();
    const first = { id: "same", renderFrame: vi.fn(), dispose: vi.fn() };
    const second = { id: "same", renderFrame: vi.fn(), dispose: vi.fn() };
    registry.registerEffect(first);
    registry.registerComposition(second);
    expect(first.dispose).toHaveBeenCalledOnce();
    expect(registry.getEffectIds()).toEqual([]);
    expect(registry.getRenderer("same")?.kind).toBe("composition");
    registry.moduleRevisions.set("same", "v1");
    registry.disposeAll();
    expect(second.dispose).toHaveBeenCalledOnce();
    expect(registry.moduleRevisions.size).toBe(0);
  });
});

it("preserves renderer receivers and the normalized composition kind", async () => {
  const registry = createSandboxRegistry();
  const disposed: string[] = [];
  const input = {
    id: "receiver",
    kind: "legacy",
    renderFrame() {
      return this.kind;
    },
    dispose() {
      disposed.push(this.kind);
    },
  };
  registry.registerComposition(input);
  const context = createRenderContext({ width: 10, height: 10 }, {}, {});
  expect(await registry.getRenderer("receiver")?.renderFrame(context)).toBe(
    "composition",
  );
  registry.disposeAll();
  expect(disposed).toEqual(["composition"]);
});

it("observes asynchronous best-effort renderer disposal", async () => {
  const registry = createSandboxRegistry();
  const dispose = vi.fn(async () => {
    throw new Error("teardown failed");
  });
  registry.registerEffect({ id: "async-cleanup", renderFrame() {}, dispose });
  registry.disposeAll();
  await Promise.resolve();
  expect(dispose).toHaveBeenCalledOnce();
});
