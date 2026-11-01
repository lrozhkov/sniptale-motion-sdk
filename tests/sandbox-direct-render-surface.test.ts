import { createNativeCanvasFixture } from "./helpers/native-render-fixtures.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createDirectRenderSurfaceLease } from "../src/apps/sandbox/runtime/direct-render-surface";

describe("sandbox direct render surface lease", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("claims the presentation surface once for the output-sized canvas", () => {
    const fallbackCanvas = createNativeCanvasFixture({ fallback: true });
    const surface = createNativeCanvasFixture({ height: 720, width: 1280 });
    const presenter = {
      acquireRenderSurface: vi.fn<Presenter["acquireRenderSurface"]>(
        () => surface,
      ),
      isRenderSurface: vi.fn<Presenter["isRenderSurface"]>(
        (candidate) => candidate === surface,
      ),
    };
    const fallback = vi.fn<Fallback>(() => fallbackCanvas);
    const lease = createDirectRenderSurfaceLease({
      cacheRequest: null,
      directPresentation: true,
      fallback,
      height: 720,
      presenter,
      width: 1280,
    });

    expect(lease.createCanvas(640, 360)).toBe(fallbackCanvas);
    expect(lease.createCanvas(1280, 720)).toBe(surface);
    expect(lease.createCanvas(1280, 720)).toBe(fallbackCanvas);
    expect(lease.owns(surface)).toBe(true);
  });

  it("keeps cache renders on pooled canvases", () => {
    const fallbackCanvas = createNativeCanvasFixture({ fallback: true });
    const presenter = {
      acquireRenderSurface: vi.fn<Presenter["acquireRenderSurface"]>(),
      isRenderSurface: vi.fn<Presenter["isRenderSurface"]>(),
    };
    const lease = createDirectRenderSurfaceLease({
      cacheRequest: {},
      directPresentation: true,
      fallback: () => fallbackCanvas,
      height: 720,
      presenter,
      width: 1280,
    });

    expect(lease.createCanvas(1280, 720)).toBe(fallbackCanvas);
    expect(presenter.acquireRenderSurface).not.toHaveBeenCalled();
  });
});

type Presenter = NonNullable<
  Parameters<typeof createDirectRenderSurfaceLease>[0]["presenter"]
>;
type Fallback = Parameters<
  typeof createDirectRenderSurfaceLease
>[0]["fallback"];
