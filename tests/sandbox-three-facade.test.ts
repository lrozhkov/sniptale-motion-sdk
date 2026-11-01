import { describe, expect, it } from "vitest";

import { createReactFacade } from "../src/apps/sandbox/runtime/react-facade";
import { createThreeSandboxFacade } from "../src/apps/sandbox/runtime/three-facade";
import {
  resolveThreeRenderSize,
  shouldBypassThreeRenderForBindingAudit,
} from "../src/apps/sandbox/runtime/three-render-plan";

describe("sandbox React facade", () => {
  it("creates real React elements while preserving renderToSvg", () => {
    const React = createReactFacade();
    const element = React.createElement(
      "svg",
      { viewBox: "0 0 10 10" },
      React.createElement("rect", { fill: "#fff", height: 10, width: 10 }),
    );

    expect(React.isValidElement(element)).toBe(true);
    expect(React.renderToSvg(element)).toBe(
      '<svg view-box="0 0 10 10"><rect fill="#fff" height="10" width="10"></rect></svg>',
    );
  });
});

describe("sandbox Three facade", () => {
  it("exposes a curated Three namespace without network-capable loaders", () => {
    const runtime = createThreeSandboxFacade();

    expect(runtime.THREE.Scene).toBeTypeOf("function");
    expect(runtime.THREE.MeshStandardMaterial).toBeTypeOf("function");
    expect(runtime.THREE.MathUtils).toBeTypeOf("object");
    expect(runtime.THREE).not.toHaveProperty("Loader");
    expect(runtime.THREE).not.toHaveProperty("FileLoader");
    expect(runtime.THREE).not.toHaveProperty("TextureLoader");
    expect(runtime.THREE).not.toHaveProperty("AudioLoader");
    expect(runtime.three.createFrameRenderer).toBeTypeOf("function");
    expect(runtime.r3f.createFrameRenderer).toBeTypeOf("function");
  });

  it("bounds internal WebGL surfaces to the current preview viewport", () => {
    expect(
      resolveThreeRenderSize(640, 720, { height: 90, width: 160 }),
    ).toEqual({ height: 90, width: 80 });
    expect(
      resolveThreeRenderSize(1280, 720, { height: 180, width: 320 }),
    ).toEqual({ height: 180, width: 320 });
    expect(
      resolveThreeRenderSize(640, 720, { height: 720, width: 1280 }),
    ).toEqual({ height: 720, width: 640 });
    expect(
      resolveThreeRenderSize(640, 720, { height: 180, width: 320 }, 2),
    ).toEqual({ height: 90, width: 80 });
  });

  it("bypasses GPU drawing only for contract binding-read audits", () => {
    expect(shouldBypassThreeRenderForBindingAudit("contract")).toBe(true);
    expect(shouldBypassThreeRenderForBindingAudit("full")).toBe(false);
    expect(shouldBypassThreeRenderForBindingAudit("selection")).toBe(false);
    expect(shouldBypassThreeRenderForBindingAudit(undefined)).toBe(false);
  });
});
