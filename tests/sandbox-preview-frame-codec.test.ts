import { afterEach, describe, expect, it, vi } from "vitest";

import { createNativeBitmapFixture } from "./helpers/native-render-fixtures.js";

import { createPreviewFrameRetainer } from "../src/apps/sandbox/runtime/preview-frame-codec";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("sandbox preview frame codec", () => {
  afterEach(() => vi.useRealTimers());

  it("retains a reusable bitmap when a complete sequence fits the cache", async () => {
    const retainedBitmap = createBitmap();
    const restoredBitmap = createBitmap();
    const createImageBitmap = vi
      .fn<typeof globalThis.createImageBitmap>()
      .mockResolvedValueOnce(retainedBitmap)
      .mockResolvedValueOnce(restoredBitmap);
    vi.stubGlobal("createImageBitmap", createImageBitmap);

    const retained = await createPreviewFrameRetainer()(createBitmap(), {
      preferReusableBitmap: true,
    });

    expect(retained).toMatchObject({
      bytes: 160,
      rawBytes: 160,
      storage: "bitmap",
    });
    expect(await retained.restore()).toBe(restoredBitmap);
    retained.release();
    expect(retainedBitmap.close).toHaveBeenCalledOnce();
  });

  it("stores lossless PNG data with transparency and restores on demand", async () => {
    const context = {
      clearRect: vi.fn<OffscreenCanvasRenderingContext2D["clearRect"]>(),
      drawImage: vi.fn<OffscreenCanvasRenderingContext2D["drawImage"]>(),
    };
    const png = new Blob([new Uint8Array(37)], { type: "image/png" });
    const contextOptions: unknown[] = [];
    class FakeOffscreenCanvas {
      height: number;
      width: number;
      constructor(width: number, height: number) {
        this.height = height;
        this.width = width;
      }
      getContext(_type: string, options: unknown) {
        contextOptions.push(options);
        return context;
      }
      async convertToBlob() {
        return png;
      }
    }
    const restored = createBitmap();
    const createImageBitmap = vi.fn<typeof globalThis.createImageBitmap>(
      async () => restored,
    );
    vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
    vi.stubGlobal("createImageBitmap", createImageBitmap);

    const retain = createPreviewFrameRetainer();
    const source = createBitmap();
    const retained = await retain(source);

    expect(retained).toMatchObject({
      bytes: 37,
      height: 5,
      rawBytes: 160,
      storage: "png",
      width: 8,
    });
    expect(contextOptions).toEqual([{ alpha: true, willReadFrequently: true }]);
    expect(context.drawImage).toHaveBeenCalledWith(source, 0, 0);
    retained.prime?.();
    expect(await retained.restore()).toBe(restored);
    expect(createImageBitmap).toHaveBeenCalledWith(png);
    expect(createImageBitmap).toHaveBeenCalledTimes(1);
  });

  it("falls back to a bounded bitmap when PNG encoding is unavailable", async () => {
    const context = {
      clearRect: vi.fn<OffscreenCanvasRenderingContext2D["clearRect"]>(),
      drawImage: vi.fn<OffscreenCanvasRenderingContext2D["drawImage"]>(),
    };
    class FakeOffscreenCanvas {
      height: number;
      width: number;
      constructor(width: number, height: number) {
        this.height = height;
        this.width = width;
      }
      getContext() {
        return context;
      }
      async convertToBlob() {
        throw new Error("encoder unavailable");
      }
    }
    const retainedBitmap = createBitmap();
    const restoredBitmap = createBitmap();
    const createImageBitmap = vi
      .fn<typeof globalThis.createImageBitmap>()
      .mockResolvedValueOnce(retainedBitmap)
      .mockResolvedValueOnce(restoredBitmap);
    vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
    vi.stubGlobal("createImageBitmap", createImageBitmap);

    const retained = await createPreviewFrameRetainer()(createBitmap());

    expect(retained).toMatchObject({ bytes: 160, storage: "bitmap" });
    retained.prime?.();
    expect(await retained.restore()).toBe(restoredBitmap);
    expect(createImageBitmap).toHaveBeenCalledTimes(2);
    retained.release();
    expect(retainedBitmap.close).toHaveBeenCalledOnce();
  });

  it("abandons a stalled PNG encoder without blocking the rendered frame", async () => {
    vi.useFakeTimers();
    const context = {
      clearRect: vi.fn<OffscreenCanvasRenderingContext2D["clearRect"]>(),
      drawImage: vi.fn<OffscreenCanvasRenderingContext2D["drawImage"]>(),
    };
    class FakeOffscreenCanvas {
      height: number;
      width: number;
      constructor(width: number, height: number) {
        this.height = height;
        this.width = width;
      }
      getContext() {
        return context;
      }
      convertToBlob() {
        return new Promise<Blob>(() => {});
      }
    }
    const retainedBitmap = createBitmap();
    const createImageBitmap = vi.fn<typeof globalThis.createImageBitmap>(
      async () => retainedBitmap,
    );
    vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
    vi.stubGlobal("createImageBitmap", createImageBitmap);

    const pending = createPreviewFrameRetainer()(createBitmap());
    await vi.advanceTimersByTimeAsync(2_000);
    const retained = await pending;

    expect(retained).toMatchObject({ bytes: 160, storage: "bitmap" });
    expect(createImageBitmap).toHaveBeenCalledOnce();
    retained.release();
    expect(retainedBitmap.close).toHaveBeenCalledOnce();
  });
});

it.each([false, true])(
  "releases a bitmap after the deadline (reusable=%s)",
  async (preferReusableBitmap) => {
    vi.useFakeTimers();
    let resolveLate: (bitmap: ImageBitmap) => void = () => {
      throw new Error("Decoder is not ready.");
    };
    const decoded = new Promise<ImageBitmap>((resolve) => {
      resolveLate = resolve;
    });
    vi.stubGlobal("OffscreenCanvas", undefined);
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn<typeof globalThis.createImageBitmap>(() => decoded),
    );
    const pending = createPreviewFrameRetainer()(createBitmap(), {
      preferReusableBitmap,
    });
    await Promise.all([
      expect(pending).rejects.toThrow("codec did not respond"),
      vi.advanceTimersByTimeAsync(2_000),
    ]);
    const late = createBitmap();
    resolveLate(late);
    await Promise.resolve();
    expect(late.close).toHaveBeenCalledOnce();
    vi.useRealTimers();
  },
);

it("bounds restoration time and releases the late decoded bitmap", async () => {
  vi.useFakeTimers();
  const source = createBitmap();
  const retainedBitmap = createBitmap();
  let resolveDecode: (bitmap: ImageBitmap) => void = () => {
    throw new Error("Decoder is not ready.");
  };
  const decoded = new Promise<ImageBitmap>((resolve) => {
    resolveDecode = resolve;
  });
  let calls = 0;
  vi.stubGlobal("OffscreenCanvas", undefined);
  vi.stubGlobal("createImageBitmap", () =>
    ++calls === 1 ? Promise.resolve(retainedBitmap) : decoded,
  );
  const retained = await createPreviewFrameRetainer()(source);
  const restoration = retained.restore();
  await Promise.all([
    expect(restoration).rejects.toThrow("codec did not respond"),
    vi.advanceTimersByTimeAsync(2_000),
  ]);
  const late = createBitmap();
  resolveDecode(late);
  await Promise.resolve();
  expect(late.close).toHaveBeenCalledOnce();
  retained.release();
  expect(retainedBitmap.close).toHaveBeenCalledOnce();
});

function createBitmap() {
  const bitmap = createNativeBitmapFixture({ width: 8, height: 5 });
  return Object.assign(bitmap, { close: vi.spyOn(bitmap, "close") });
}
