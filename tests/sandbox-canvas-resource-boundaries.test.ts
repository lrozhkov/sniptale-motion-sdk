import { afterEach, describe, expect, it, vi } from "vitest";
import { createFrameCanvasPool } from "../src/apps/sandbox/runtime/frame-canvas-pool";
import {
  createLogicalCanvasFactory,
  getLogicalCanvasScale,
} from "../src/apps/sandbox/runtime/logical-canvas";
import { normalizeRenderResult } from "../src/apps/sandbox/runtime/render-result";
import type { RuntimeCanvas } from "../src/apps/sandbox/runtime/canvas-model";
afterEach(() => vi.unstubAllGlobals());
describe("frame canvas lease boundaries", () => {
  it("rejects allocation through a released lease", () => {
    const createCanvas = vi.fn((width: number, height: number) => ({
      width,
      height,
      getContext: () => ({ reset() {} }),
    }));
    const pool = createFrameCanvasPool(createCanvas);
    const frame = pool.beginFrame("effect");
    frame.createCanvas(200, 100);
    frame.release();
    expect(() => frame.createCanvas(200, 100)).toThrow();
    frame.release();
    expect(createCanvas).toHaveBeenCalledOnce();
  });
  it("evicts the least recently used free canvas within capacity", () => {
    const createCanvas = vi.fn((width: number, height: number) => ({
      width,
      height,
      getContext: () => ({ reset() {} }),
    }));
    const pool = createFrameCanvasPool(createCanvas, 2);
    const take = (owner: string) => {
      const lease = pool.beginFrame(owner);
      const canvas = lease.createCanvas(200, 100);
      lease.release();
      return canvas;
    };
    const a = take("a");
    const b = take("b");
    expect(take("a")).toBe(a);
    take("c");
    expect(pool.size()).toBe(2);
    expect(take("a")).toBe(a);
    expect(take("b")).not.toBe(b);
    expect(createCanvas).toHaveBeenCalledTimes(4);
  });
  it("does not evict active canvases when the retained pool is full", () => {
    const createCanvas = vi.fn((width: number, height: number) => ({
      width,
      height,
      getContext: () => ({ reset() {} }),
    }));
    const pool = createFrameCanvasPool(createCanvas, 1);
    const first = pool.beginFrame("a");
    const a = first.createCanvas(200, 100);
    const overlap = pool.beginFrame("a");
    const b = overlap.createCanvas(200, 100);
    expect(a).not.toBe(b);
    expect(pool.size()).toBe(1);
    first.release();
    overlap.release();
    const next = pool.beginFrame("a");
    expect(next.createCanvas(200, 100)).toBe(a);
    next.release();
  });
  it("does not coerce foreign logical scale values", () => {
    const convert = vi.fn(() => {
      throw new Error("foreign conversion");
    });
    expect(
      getLogicalCanvasScale({
        __sniptaleLogicalScaleX: { valueOf: convert },
      } as any),
    ).toEqual({ x: 1, y: 1, uniform: 1 });
    expect(convert).not.toHaveBeenCalled();
  });
});
describe("logical canvas allocation", () => {
  it("reports a missing native context before returning an unconfigured canvas", () => {
    const create = createLogicalCanvasFactory({
      createCanvas: (width, height) => ({
        width,
        height,
        getContext: () => null,
      }),
      outputWidth: 200,
      outputHeight: 100,
      renderWidth: 100,
      renderHeight: 50,
    });
    expect(() => create(200, 100)).toThrow(
      "Logical canvas 2D context is unavailable.",
    );
  });
});
describe("raster normalization ownership", () => {
  it.each(["factory", "context", "draw", "bitmap"] as const)(
    "closes the source bitmap if %s fails",
    async (mode) => {
      class TestBitmap {}
      const bitmap = Object.assign(new TestBitmap(), {
        width: 200,
        height: 100,
        close: vi.fn(),
      });
      vi.stubGlobal("ImageBitmap", TestBitmap);
      const failure = new Error("normalization failed");
      const createCanvas = () => {
        if (mode === "factory") throw failure;
        return {
          getContext: () =>
            mode === "context"
              ? null
              : {
                  clearRect() {},
                  drawImage() {
                    if (mode === "draw") throw failure;
                  },
                },
          transferToImageBitmap() {
            throw failure;
          },
        } as unknown as RuntimeCanvas;
      };
      await expect(
        normalizeRenderResult(
          bitmap,
          { width: 200, height: 100 },
          async () => {
            throw failure;
          },
          { createCanvas, width: 100, height: 50 },
        ),
      ).rejects.toThrow();
      expect(bitmap.close).toHaveBeenCalledOnce();
    },
  );
});

describe("opaque raster dimensions", () => {
  it("uses source dimensions when no explicit raster size is supplied", async () => {
    class TestCanvas {
      width = 200;
      height = 100;
    }
    vi.stubGlobal("OffscreenCanvas", TestCanvas);
    const source = new TestCanvas();
    const output = { width: 200, height: 100 };
    const createCanvas = vi.fn(
      () =>
        ({
          getContext: () => ({
            setTransform() {},
            fillRect() {},
            drawImage() {},
          }),
          transferToImageBitmap: () => output,
        }) as unknown as RuntimeCanvas,
    );
    expect(
      await normalizeRenderResult(
        source,
        { width: 200, height: 100 },
        async () => {
          throw new Error("not used");
        },
        { createCanvas, opaqueBackground: true },
      ),
    ).toBe(output);
    expect(createCanvas).toHaveBeenCalledExactlyOnceWith(200, 100);
  });
});

describe("unchanged bitmap ownership", () => {
  it("returns an existing bitmap without closing or copying it", async () => {
    class TestBitmap {}
    vi.stubGlobal("ImageBitmap", TestBitmap);
    const bitmap = Object.assign(new TestBitmap(), {
      width: 200,
      height: 100,
      close: vi.fn(),
    });
    const createCanvas = vi.fn((): RuntimeCanvas => {
      throw new Error("must not allocate");
    });
    expect(
      await normalizeRenderResult(
        bitmap,
        { width: 200, height: 100 },
        async () => {
          throw new Error("not used");
        },
        { createCanvas, width: 200, height: 100 },
      ),
    ).toBe(bitmap);
    expect(bitmap.close).not.toHaveBeenCalled();
    expect(createCanvas).not.toHaveBeenCalled();
  });
});
