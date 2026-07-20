import { describe, expect, it } from "vitest";

import { createSandboxRegistry } from "../src/apps/sandbox/runtime/registry";
import { createSandboxRuntimeFacade } from "../src/apps/sandbox/runtime/runtime-facade";

describe("sandbox optional runtime capabilities", () => {
  it("does not expose heavyweight runtimes before a module requests them", async () => {
    const runtime = createSandboxRuntimeFacade(createSandboxRegistry());

    expect(runtime).not.toHaveProperty("AbsoluteFill");
    expect(runtime).not.toHaveProperty("Easing");
    expect(runtime).not.toHaveProperty("interpolate");
    expect(runtime).not.toHaveProperty("motion");
    expect(runtime).not.toHaveProperty("sequenceFrames");
    expect(runtime).not.toHaveProperty("spring");
    expect(runtime).not.toHaveProperty("timelineContext");
    expect(runtime).not.toHaveProperty("withTransformOrigin");
    expect(() => runtime.React).toThrow(/react module capability/);
    expect(() => runtime.THREE).toThrow(/three module capability/);
    await runtime.__prepareRuntimeCapabilities([]);
    expect(() => runtime.r3f).toThrow(/r3f module capability/);
  });

  it("loads the declared R3F runtime and its dependencies once", async () => {
    const runtime = createSandboxRuntimeFacade(createSandboxRegistry());

    await Promise.all([
      runtime.__prepareRuntimeCapabilities(["r3f"]),
      runtime.__prepareRuntimeCapabilities(["r3f"]),
    ]);

    expect(runtime.React.createElement).toBeTypeOf("function");
    expect(runtime.THREE.Scene).toBeTypeOf("function");
    expect(runtime.three.createFrameRenderer).toBeTypeOf("function");
    expect(runtime.r3f.createFrameRenderer).toBeTypeOf("function");
  });
});
