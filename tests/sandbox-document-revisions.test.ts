import { describe, expect, it, vi } from "vitest";
import { createStarterDocument } from "../src/apps/cli/starter";
import { loadSandboxEffectDocument } from "../src/apps/sandbox/runtime/effect-v1/document-session";
import { createSandboxRegistry } from "../src/apps/sandbox/runtime/registry";
import { parseSandboxRuntimeMessage } from "../src/apps/sandbox/runtime/message-boundary";

// The graph factory only captures this runtime; no frame is executed by a load.
const runtime = {} as Parameters<typeof loadSandboxEffectDocument>[2];
describe("sandbox versioned document loading", () => {
  it("replaces a module for a new revision and is idempotent for the same revision", async () => {
    const registry = createSandboxRegistry();
    const sink = vi.fn();
    const first = createStarterDocument("same", "standalone");
    await loadSandboxEffectDocument(sink, registry, runtime, {
      kind: "loadEffectDocument",
      requestId: "first",
      moduleId: "stable",
      revision: "v1",
      document: first,
    });
    const original = registry.getRenderer("same");
    await loadSandboxEffectDocument(sink, registry, runtime, {
      kind: "loadEffectDocument",
      requestId: "repeat",
      moduleId: "stable",
      revision: "v1",
      document: first,
    });
    expect(registry.getRenderer("same")).toBe(original);
    const second = createStarterDocument("same", "targetEffect");
    await loadSandboxEffectDocument(sink, registry, runtime, {
      kind: "loadEffectDocument",
      requestId: "second",
      moduleId: "stable",
      revision: "v2",
      document: second,
    });
    expect(registry.getRenderer("same")).not.toBe(original);
    expect(registry.getCompositionIds()).toEqual([]);
    expect(registry.getEffectIds()).toEqual(["same"]);
    expect(registry.loadedModules.size).toBe(1);
    expect(registry.moduleRevisions.get("stable")).toBe("v2");
  });

  it("parses bounded revision values without coercion", () => {
    const document = createStarterDocument("sample", "standalone");
    const message = {
      kind: "loadEffectDocument",
      moduleId: "stable",
      requestId: "request",
      document,
    };
    expect(
      parseSandboxRuntimeMessage({ ...message, revision: "v1" }),
    ).toMatchObject({ revision: "v1" });
    for (const revision of [null, 42, {}, "", "x".repeat(129)])
      expect(parseSandboxRuntimeMessage({ ...message, revision })).toBeNull();
  });
});
