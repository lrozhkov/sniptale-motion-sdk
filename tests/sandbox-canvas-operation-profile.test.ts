import { describe, expect, it } from "vitest";

import { createCanvasOperationProfiler } from "../src/apps/sandbox/runtime/canvas-operation-profile";
import { createSandboxRenderProfile } from "../src/apps/sandbox/runtime/render-profile";

describe("sandbox canvas operation profiler", () => {
  it("counts expensive canvas calls and restores the native context surface", () => {
    class DrawingContext {
      filter = "blur(8px)";
      shadowBlur = 12;
      createLinearGradient(
        _x0: number,
        _y0: number,
        _x1: number,
        _y1: number,
      ): object {
        return {};
      }
      drawImage(_source: unknown): void {}
      fill(): void {}
    }
    const context = new DrawingContext();
    const profile = createSandboxRenderProfile(0);
    if (!profile) throw new Error("Missing render profile fixture.");
    const profiler = createCanvasOperationProfiler(
      () => ({ getContext: () => context }),
      profile,
    );

    profiler.createCanvas(1280, 720);
    context.drawImage({});
    context.fill();
    context.createLinearGradient(0, 0, 1, 1);
    profiler.restore();

    expect(profile).toMatchObject({
      canvasCallCount: 3,
      canvasDrawImageCount: 1,
      canvasFillCount: 1,
      canvasFilteredDrawImageCount: 1,
      canvasGradientCount: 1,
      canvasShadowCount: 2,
    });
    expect(Object.hasOwn(context, "drawImage")).toBe(false);
    expect(Object.hasOwn(context, "fill")).toBe(false);
  });
});
