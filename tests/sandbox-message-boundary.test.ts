import { describe, expect, it } from "vitest";

import { parseSandboxRuntimeMessage } from "../src/apps/sandbox/runtime/message-boundary";

describe("sandbox message boundary", () => {
  it("rejects non-object and unknown messages", () => {
    expect(parseSandboxRuntimeMessage(null)).toBeNull();
    expect(parseSandboxRuntimeMessage("renderFrame")).toBeNull();
    expect(parseSandboxRuntimeMessage({ kind: "unknown" })).toBeNull();
  });

  it("rejects executable module messages in release builds", () => {
    expect(
      parseSandboxRuntimeMessage({
        kind: "loadEffectModule",
        moduleId: "module-a",
        requestId: "load:1",
        source: "SniptaleSandboxRuntime.registerEffect({})",
      }),
    ).toBeNull();
    expect(
      parseSandboxRuntimeMessage({
        kind: "loadEffectModule",
        moduleId: "module-a",
        requestId: "load:2",
        runtimeCapabilities: ["react", "three", "r3f"],
        source: "SniptaleSandboxRuntime.registerEffect({})",
      }),
    ).toBeNull();
    expect(
      parseSandboxRuntimeMessage({
        kind: "loadEffectModule",
        moduleId: "module-a",
      }),
    ).toBeNull();
  });

  it("narrows validated Effect v1 document messages", () => {
    const document = {
      assets: [],
      clips: [],
      controls: [],
      duration: 1,
      id: "safe-effect",
      kind: "standalone",
      label: { en: "Safe effect", ru: "Безопасный эффект" },
      layers: [],
      program: {
        commands: [{ color: "#000000", op: "clear" }],
        kind: "graph",
        version: 1,
      },
      scenes: [{ duration: 1, id: "main", start: 0 }],
      schemaVersion: "sniptale.effect.v1",
      timeline: { phases: [], tracks: [] },
    };

    expect(
      parseSandboxRuntimeMessage({
        document,
        kind: "loadEffectDocument",
        moduleId: "safe-effect",
        requestId: "load:document:1",
      }),
    ).toEqual({
      document,
      kind: "loadEffectDocument",
      moduleId: "safe-effect",
      requestId: "load:document:1",
    });

    expect(
      parseSandboxRuntimeMessage({
        document,
        kind: "validateEffectDocument",
        requestId: "validate:document:1",
      }),
    ).toEqual({
      document,
      kind: "validateEffectDocument",
      requestId: "validate:document:1",
    });
    expect(
      parseSandboxRuntimeMessage({
        document: [],
        kind: "validateEffectDocument",
        requestId: "validate:document:invalid",
      }),
    ).toBeNull();
  });

  it("rejects malformed optional runtime capabilities", () => {
    const message = {
      kind: "loadEffectModule",
      moduleId: "module-a",
      requestId: "load:1",
      source: "SniptaleSandboxRuntime.registerEffect({})",
    };

    expect(
      parseSandboxRuntimeMessage({
        ...message,
        runtimeCapabilities: "three",
      }),
    ).toBeNull();
    expect(
      parseSandboxRuntimeMessage({
        ...message,
        runtimeCapabilities: ["webgpu"],
      }),
    ).toBeNull();
    expect(
      parseSandboxRuntimeMessage({
        ...message,
        runtimeCapabilities: ["three", "three"],
      }),
    ).toBeNull();
  });

  it("narrows render messages while preserving render payload fields", () => {
    expect(
      parseSandboxRuntimeMessage({
        effectId: "effect-a",
        bindingLayerId: "logo",
        bindingReadMode: "selection",
        directPresentation: true,
        previewCacheWarm: true,
        previewCacheRange: { endFrame: 61, startFrame: 30 },
        fps: 30,
        height: 180,
        kind: "renderFrame",
        outputHeight: 720,
        outputWidth: 1280,
        opaqueBackground: true,
        previewCacheEnabled: true,
        profileCanvasOperations: true,
        profileRender: true,
        requestId: "render:1",
        sequenceId: 7,
        untrustedField: "must not cross the boundary",
        width: 320,
      }),
    ).toMatchObject({
      effectId: "effect-a",
      bindingLayerId: "logo",
      bindingReadMode: "selection",
      directPresentation: true,
      previewCacheWarm: true,
      previewCacheRange: { endFrame: 61, startFrame: 30 },
      previewCacheEnabled: true,
      profileCanvasOperations: true,
      profileRender: true,
      fps: 30,
      height: 180,
      kind: "renderFrame",
      outputHeight: 720,
      outputWidth: 1280,
      opaqueBackground: true,
      renderQuality: "full",
      requestId: "render:1",
      sequenceId: 7,
      width: 320,
    });
    expect(
      parseSandboxRuntimeMessage({
        effectId: "effect-a",
        height: 180,
        kind: "renderFrame",
        requestId: "render:string-sequence",
        sequenceId: "7",
        width: 320,
      }),
    ).toBeNull();
    expect(
      parseSandboxRuntimeMessage({
        effectId: "effect-a",
        height: 180,
        kind: "renderFrame",
        requestId: "render:unknown-field",
        sequenceId: 7,
        untrustedField: "must not cross the boundary",
        width: 320,
      }),
    ).not.toHaveProperty("untrustedField");
    expect(
      parseSandboxRuntimeMessage({
        effectId: "effect-a",
        height: 180,
        kind: "renderFrame",
        opaqueBackground: "black",
        requestId: "render:invalid-opaque-background",
        width: 320,
      }),
    ).toBeNull();
    expect(
      parseSandboxRuntimeMessage({
        effectId: "effect-a",
        height: 180,
        kind: "renderFrame",
        previewCacheEnabled: "yes",
        requestId: "render:invalid-cache-enabled",
        width: 320,
      }),
    ).toBeNull();
    expect(
      parseSandboxRuntimeMessage({
        effectId: "effect-a",
        height: 180,
        kind: "renderFrame",
        profileCanvasOperations: true,
        requestId: "render:orphan-profile-operations",
        width: 320,
      }),
    ).toBeNull();
    expect(
      parseSandboxRuntimeMessage({
        effectId: "effect-a",
        height: 180,
        kind: "renderFrame",
        profileRender: "yes",
        requestId: "render:invalid-profile",
        width: 320,
      }),
    ).toBeNull();
    expect(
      parseSandboxRuntimeMessage({
        effectId: "effect-a",
        height: 180,
        kind: "renderFrame",
        previewCacheRange: { endFrame: 30, startFrame: 30 },
        requestId: "render:invalid-cache-range",
        width: 320,
      }),
    ).toBeNull();
    expect(
      parseSandboxRuntimeMessage({
        effectId: "effect-a",
        height: 180,
        kind: "renderFrame",
        previewCacheRange: "30-60",
        requestId: "render:invalid-cache-range-shape",
        width: 320,
      }),
    ).toBeNull();
    expect(
      parseSandboxRuntimeMessage({
        effectId: "effect-a",
        height: 180,
        kind: "renderFrame",
        previewCacheWarm: "yes",
        requestId: "render:invalid-cache-warm",
        width: 320,
      }),
    ).toBeNull();
    expect(
      parseSandboxRuntimeMessage({
        effectId: "effect-a",
        bindingReadMode: "contract",
        height: 180,
        kind: "renderFrame",
        requestId: "render:contract",
        width: 320,
      }),
    ).toMatchObject({ bindingReadMode: "contract" });
    expect(
      parseSandboxRuntimeMessage({
        effectId: "effect-a",
        height: 180,
        kind: "renderFrame",
        renderQuality: "reduced",
        requestId: "render:2",
        sequenceId: 8,
        width: 320,
      }),
    ).toMatchObject({ renderQuality: "reduced" });
    expect(
      parseSandboxRuntimeMessage({
        effectId: "effect-a",
        height: 180,
        kind: "renderFrame",
        renderQuality: "fast-ish",
        requestId: "render:3",
        width: 320,
      }),
    ).toBeNull();
    expect(
      parseSandboxRuntimeMessage({
        bindingReadMode: "everything",
        effectId: "effect-a",
        height: 180,
        kind: "renderFrame",
        requestId: "render:invalid-bindings",
        width: 320,
      }),
    ).toBeNull();
    expect(
      parseSandboxRuntimeMessage({
        effectId: "effect-a",
        height: 180,
        kind: "renderFrame",
        outputWidth: 0,
        requestId: "render:4",
        width: 320,
      }),
    ).toBeNull();
    expect(
      parseSandboxRuntimeMessage({
        kind: "renderFrame",
        requestId: "render:1",
      }),
    ).toBeNull();
    expect(
      parseSandboxRuntimeMessage({
        effectId: "effect-a",
        height: 180,
        kind: "renderFrame",
        renderModel: {},
        requestId: "render:5",
        width: 320,
      }),
    ).toBeNull();
    expect(
      parseSandboxRuntimeMessage({
        effectId: "effect-a",
        height: 180,
        kind: "renderFrame",
        renderModelId: "model-a",
        requestId: "render:6",
        width: 320,
      }),
    ).toMatchObject({ renderModelId: "model-a" });
    expect(
      parseSandboxRuntimeMessage({
        effectId: "effect-a",
        height: 180,
        kind: "renderFrame",
        renderAssetsId: "render-assets-a",
        requestId: "render:7",
        width: 320,
      }),
    ).toMatchObject({ renderAssetsId: "render-assets-a" });
    expect(
      parseSandboxRuntimeMessage({
        assets: [],
        effectId: "effect-a",
        height: 180,
        kind: "renderFrame",
        requestId: "render:8",
        width: 320,
      }),
    ).toBeNull();
    expect(
      parseSandboxRuntimeMessage({
        effectId: "effect-a",
        height: 180,
        kind: "renderFrame",
        renderAssetsId: "",
        requestId: "render:9",
        width: 320,
      }),
    ).toBeNull();
  });

  it("preserves validated opaque bitmap transfers", () => {
    const bitmap = { close() {}, height: 90, width: 160 };
    const parsed = parseSandboxRuntimeMessage({
      assets: {
        logo: { bitmap, cacheKey: "logo-v1", id: "logo" },
      },
      effectId: "effect-a",
      height: 90,
      inputFrames: { source: bitmap },
      kind: "renderFrame",
      requestId: "render:opaque",
      sequenceId: 1,
      width: 160,
    });

    expect(parsed).toMatchObject({ kind: "renderFrame" });
    if (parsed?.kind !== "renderFrame")
      throw new Error("Expected render message.");
    expect(parsed.assets?.logo).toMatchObject({ bitmap });
    expect(parsed.inputFrames?.source).toBe(bitmap);
  });

  it("applies one aggregate string budget across render structures", () => {
    const large = "x".repeat(1_100_000);
    expect(
      parseSandboxRuntimeMessage({
        assets: {
          a: { svgText: large },
          b: { svgText: large },
          c: { svgText: large },
        },
        effectId: "effect-a",
        height: 90,
        kind: "renderFrame",
        requestId: "render:string-budget",
        sequenceId: 1,
        width: 160,
      }),
    ).toBeNull();
  });

  it("applies one aggregate node budget across direct and cached models", () => {
    const records = Array.from({ length: 9_000 }, () => ({}));
    expect(
      parseSandboxRuntimeMessage({
        clips: records,
        effectId: "effect-a",
        height: 90,
        kind: "renderFrame",
        layers: records,
        renderModel: {
          clips: records,
          duration: 1,
          layers: records,
          scenes: records,
          timeline: { phases: [], tracks: [] },
        },
        renderModelId: "large-model",
        requestId: "render:node-budget",
        scenes: records,
        sequenceId: 1,
        width: 160,
      }),
    ).toBeNull();
  });
});
