import { describe, expect, it } from "vitest";

import { installCanvasRenderQuality } from "../src/apps/sandbox/runtime/canvas-render-quality";

describe("sandbox canvas render quality", () => {
  it("suppresses expensive pixel effects only for a reduced frame", () => {
    const context = new TestCanvasContext();
    let quality: "full" | "reduced" = "full";
    const previousOffscreenContext =
      globalThis.OffscreenCanvasRenderingContext2D;
    const previousCanvasContext = globalThis.CanvasRenderingContext2D;
    Object.assign(globalThis, {
      CanvasRenderingContext2D: undefined,
      OffscreenCanvasRenderingContext2D: TestCanvasContext,
    });
    try {
      installCanvasRenderQuality(() => quality);
      context.filter = "blur(12px) brightness(0.7)";
      context.globalCompositeOperation = "screen";
      context.shadowBlur = 24;
      expect(context.appliedFilter).toBe("blur(12px) brightness(0.7)");
      expect(context.appliedGlobalCompositeOperation).toBe("screen");
      expect(context.appliedShadowBlur).toBe(24);

      quality = "reduced";
      context.filter = "blur(12px) brightness(0.7)";
      context.globalCompositeOperation = "screen";
      context.shadowBlur = 24;
      expect(context.appliedFilter).toBe("none");
      expect(context.appliedGlobalCompositeOperation).toBe("source-over");
      expect(context.appliedShadowBlur).toBe(0);

      context.globalCompositeOperation = "destination-in";
      expect(context.appliedGlobalCompositeOperation).toBe("destination-in");
    } finally {
      Object.assign(globalThis, {
        CanvasRenderingContext2D: previousCanvasContext,
        OffscreenCanvasRenderingContext2D: previousOffscreenContext,
      });
    }
  });
});

class TestCanvasContext {
  appliedFilter = "none";
  appliedGlobalCompositeOperation = "source-over";
  appliedShadowBlur = 0;

  set filter(value: string) {
    this.appliedFilter = value;
  }

  get filter(): string {
    return this.appliedFilter;
  }

  set globalCompositeOperation(value: string) {
    this.appliedGlobalCompositeOperation = value;
  }

  get globalCompositeOperation(): string {
    return this.appliedGlobalCompositeOperation;
  }

  set shadowBlur(value: number) {
    this.appliedShadowBlur = value;
  }

  get shadowBlur(): number {
    return this.appliedShadowBlur;
  }
}
