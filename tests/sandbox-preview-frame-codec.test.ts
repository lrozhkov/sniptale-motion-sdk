import { afterEach, describe, expect, it, vi } from "vitest";

import { createPreviewFrameRetainer } from "../src/apps/sandbox/runtime/preview-frame-codec";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sandbox preview frame codec", () => {
  afterEach(() => vi.useRealTimers());

  it("retains a reusable bitmap when a complete sequence fits the cache", async () => {
    const retainedBitmap = {
      close: vi.fn(),
      height: 5,
      width: 8,
    };
    const restoredBitmap = { height: 5, width: 8 };
    const createImageBitmap = vi
      .fn()
      .mockResolvedValueOnce(retainedBitmap)
      .mockResolvedValueOnce(restoredBitmap);
    vi.stubGlobal("createImageBitmap", createImageBitmap);

    const retained = await createPreviewFrameRetainer()(
      { height: 5, width: 8 },
      { preferReusableBitmap: true },
    );

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
    const context = { clearRect: vi.fn(), drawImage: vi.fn() };
    const png = { size: 37 };
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
    const restored = { height: 5, width: 8 };
    const createImageBitmap = vi.fn(async () => restored);
    vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
    vi.stubGlobal("createImageBitmap", createImageBitmap);

    const retain = createPreviewFrameRetainer();
    const source = { height: 5, width: 8 };
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
    const context = { clearRect: vi.fn(), drawImage: vi.fn() };
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
    const retainedBitmap = { close: vi.fn(), height: 5, width: 8 };
    const restoredBitmap = { height: 5, width: 8 };
    const createImageBitmap = vi
      .fn()
      .mockResolvedValueOnce(retainedBitmap)
      .mockResolvedValueOnce(restoredBitmap);
    vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
    vi.stubGlobal("createImageBitmap", createImageBitmap);

    const retained = await createPreviewFrameRetainer()({
      height: 5,
      width: 8,
    });

    expect(retained).toMatchObject({ bytes: 160, storage: "bitmap" });
    retained.prime?.();
    expect(await retained.restore()).toBe(restoredBitmap);
    expect(createImageBitmap).toHaveBeenCalledTimes(2);
    retained.release();
    expect(retainedBitmap.close).toHaveBeenCalledOnce();
  });

  it("abandons a stalled PNG encoder without blocking the rendered frame", async () => {
    vi.useFakeTimers();
    const context = { clearRect: vi.fn(), drawImage: vi.fn() };
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
    const retainedBitmap = { close: vi.fn(), height: 5, width: 8 };
    const createImageBitmap = vi.fn(async () => retainedBitmap);
    vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
    vi.stubGlobal("createImageBitmap", createImageBitmap);

    const pending = createPreviewFrameRetainer()({ height: 5, width: 8 });
    await vi.advanceTimersByTimeAsync(2_000);
    const retained = await pending;

    expect(retained).toMatchObject({ bytes: 160, storage: "bitmap" });
    expect(createImageBitmap).toHaveBeenCalledOnce();
    retained.release();
    expect(retainedBitmap.close).toHaveBeenCalledOnce();
  });
});
