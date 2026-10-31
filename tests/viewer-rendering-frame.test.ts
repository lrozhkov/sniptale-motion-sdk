import { describe, expect, it, vi } from "vitest";

import {
  shouldUseDirectPreviewSurface,
  shouldUseFastPreviewSurface,
} from "../src/apps/viewer/rendering/frame";
import {
  syncDirectPreviewSurface,
  syncPreviewSurfaceVisibility,
} from "../src/apps/viewer/rendering/preview-surfaces";
import {
  estimateFullResolutionRenderMs,
  updateFullResolutionRenderAverage,
} from "../src/apps/viewer/rendering/render-metrics";
import { recordDirectPreviewPresentation } from "../src/apps/viewer/rendering/presentation-cadence";

describe("viewer full-resolution render cost estimation", () => {
  it("keeps direct full-resolution measurements unchanged", () => {
    expect(estimateFullResolutionRenderMs(120, 1)).toBe(120);
  });

  it("uses a conservative estimate for scaled previews", () => {
    expect(estimateFullResolutionRenderMs(10, 0.5)).toBe(50);
    expect(estimateFullResolutionRenderMs(4, 0.125)).toBe(320);
  });

  it("replaces scaled estimates with an authoritative full-size measurement", () => {
    expect(updateFullResolutionRenderAverage(900, 58, 1, 4)).toBe(58);
    expect(updateFullResolutionRenderAverage(900, 400, 0.5, 4)).toBe(825);
    expect(updateFullResolutionRenderAverage(0, 320, 0.25, 1)).toBe(320);
  });
});

describe("viewer interactive preview surface", () => {
  it("uses the transferable bitmap surface for direct interactive frames", () => {
    const ctx = {
      refs: { canvas: { height: 720, width: 1280 } },
      state: { canvasTransformDragActive: false, playing: true },
    } as any;

    expect(
      shouldUseFastPreviewSurface(
        ctx,
        { kind: "composition" },
        { height: 90, width: 160 },
      ),
    ).toBe(true);
    expect(
      shouldUseFastPreviewSurface(
        ctx,
        { kind: "layerEffect" },
        { height: 90, width: 160 },
      ),
    ).toBe(false);
    expect(
      shouldUseFastPreviewSurface(
        ctx,
        { kind: "composition" },
        { height: 720, width: 1280 },
      ),
    ).toBe(true);

    ctx.state.playing = false;
    expect(
      shouldUseFastPreviewSurface(
        ctx,
        { kind: "composition" },
        { height: 90, width: 160 },
      ),
    ).toBe(false);
  });

  it("uses adaptive direct presentation for Live playback and canvas transforms", () => {
    const ctx = {
      refs: { canvas: { height: 720, width: 1280 } },
      state: {
        canvasTransformDragActive: false,
        directLiveRenderKeys: new Set(),
        directRenderEffectIds: new Set(["composition-a"]),
        directRenderResponsePort: { presentationSurfaceAttached: true },
        playing: true,
        previewCacheEnabled: true,
        previewRasterHeight: 720,
        previewRasterWidth: 1280,
        previewVideoCache: { recording: false },
      },
    } as any;
    const template = { effectId: "composition-a", kind: "composition" };

    expect(shouldUseDirectPreviewSurface(ctx, template, { scale: 0.25 })).toBe(
      false,
    );
    expect(shouldUseDirectPreviewSurface(ctx, template, { scale: 1 })).toBe(
      false,
    );
    ctx.state.previewCacheEnabled = false;
    expect(shouldUseDirectPreviewSurface(ctx, template, { scale: 1 })).toBe(
      false,
    );
    ctx.state.directLiveRenderKeys.add("composition-a:1280x720");
    expect(shouldUseDirectPreviewSurface(ctx, template, { scale: 1 })).toBe(
      true,
    );
    ctx.state.previewVideoCache.recording = true;
    expect(shouldUseDirectPreviewSurface(ctx, template, { scale: 1 })).toBe(
      false,
    );
    ctx.state.previewVideoCache.recording = false;
    ctx.state.previewCacheEnabled = true;
    ctx.state.playing = false;
    ctx.state.canvasTransformDragActive = true;
    expect(shouldUseDirectPreviewSurface(ctx, template, { scale: 0.25 })).toBe(
      true,
    );
    expect(shouldUseDirectPreviewSurface(ctx, template, { scale: 1 })).toBe(
      true,
    );
    ctx.state.canvasTransformDragActive = false;
    expect(shouldUseDirectPreviewSurface(ctx, template, { scale: 0.25 })).toBe(
      false,
    );
  });
});

describe("viewer direct presentation cadence", () => {
  it("keeps a bounded sequence of worker presentation intervals", () => {
    const ctx = {
      state: {
        directPresentationIntervalsMs: [],
        lastDirectPresentationAtMs: null,
        lastDirectPresentationLocalAtMs: null,
      },
    } as any;

    recordDirectPreviewPresentation(ctx, 100, 10_100, 140, 10_000);
    recordDirectPreviewPresentation(ctx, 133.5, 10_133.5, 180, 10_000);
    recordDirectPreviewPresentation(ctx, 167, 10_167, 220, 10_000);
    recordDirectPreviewPresentation(ctx, Number.NaN, Number.NaN);

    expect(ctx.state.directPresentationIntervalsMs).toEqual([33.5, 33.5]);
    expect(ctx.state.lastDirectPresentationAtMs).toBe(167);
    expect(ctx.state.lastDirectPresentationLocalAtMs).toBe(167);
  });

  it("falls back to local receipt time for a previous worker payload", () => {
    const ctx = {
      state: {
        directPresentationIntervalsMs: [],
        lastDirectPresentationAtMs: null,
        lastDirectPresentationLocalAtMs: null,
      },
    } as any;

    recordDirectPreviewPresentation(ctx, 100, undefined, 240, 10_000);

    expect(ctx.state.lastDirectPresentationLocalAtMs).toBe(240);
  });
});

describe("native presentation metadata boundaries", () => {
  it("does not coerce foreign timestamp or dimension values", () => {
    const convert = vi.fn(() => {
      throw new Error("foreign conversion");
    });
    const foreign = { valueOf: convert, toString: convert };
    const ctx = {
      state: {
        directPresentationIntervalsMs: [],
        lastDirectPresentationAtMs: null,
        lastDirectPresentationLocalAtMs: null,
      },
    } as any;
    recordDirectPreviewPresentation(ctx, foreign, foreign, 100, 0);
    const canvas = { dataset: {}, hidden: true } as any;
    syncDirectPreviewSurface(
      canvas,
      { hidden: true } as any,
      foreign,
      Infinity,
    );
    expect(canvas.dataset).toEqual({ renderWidth: "1", renderHeight: "1" });
    expect(ctx.state.lastDirectPresentationAtMs).toBeNull();
    expect(convert).not.toHaveBeenCalled();
  });
  it.each(["160", true, Infinity, NaN])(
    "requires numeric finite bitmap dimensions: %j",
    (width) => {
      expect(
        shouldUseFastPreviewSurface(
          { state: { playing: true } } as any,
          { kind: "composition" },
          { width, height: 90 } as any,
        ),
      ).toBe(false);
    },
  );
});

describe("viewer direct presentation DOM state", () => {
  it("does not rewrite stable surface attributes on every frame", () => {
    const writes: string[] = [];
    const values: Record<string, string> = {
      renderHeight: "90",
      renderWidth: "160",
    };
    const dataset = new Proxy(values, {
      set(target, key, value) {
        writes.push(String(key));
        target[String(key)] = String(value);
        return true;
      },
    });
    const canvas = { dataset, hidden: false } as any;
    const fastPreviewCanvas = { hidden: true } as any;

    syncDirectPreviewSurface(canvas, fastPreviewCanvas, 160, 90);
    expect(writes).toEqual([]);

    syncDirectPreviewSurface(canvas, fastPreviewCanvas, 240, 136);
    expect(writes).toEqual(["renderWidth", "renderHeight"]);
    expect(values).toEqual({ renderHeight: "136", renderWidth: "240" });
  });

  it("changes preview surface visibility only when the active surface changes", () => {
    const writes: string[] = [];
    const surface = (name: string) => {
      let hidden = true;
      return {
        get hidden() {
          return hidden;
        },
        set hidden(value) {
          writes.push(`${name}:${value}`);
          hidden = value;
        },
      };
    };
    const fast = surface("fast");
    const direct = surface("direct");
    const preview = { style: { opacity: "" } } as any;

    syncPreviewSurfaceVisibility(fast, direct, "none", preview);
    expect(preview.style.opacity).toBe("1");
    syncPreviewSurfaceVisibility(fast, direct, "direct", preview);
    expect(preview.style.opacity).toBe("0");
    syncPreviewSurfaceVisibility(fast, direct, "direct", preview);
    syncPreviewSurfaceVisibility(fast, direct, "fast", preview);
    syncPreviewSurfaceVisibility(fast, direct, "none", preview);
    expect(preview.style.opacity).toBe("1");

    expect(writes).toEqual([
      "direct:false",
      "fast:false",
      "direct:true",
      "fast:true",
    ]);
  });
});
