import {
  createNativeCanvasFixture,
  createNativeBitmapFixture,
} from "./helpers/native-render-fixtures.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createDirectPreviewPresenter } from "../src/apps/sandbox/runtime/direct-presentation";

describe("sandbox direct preview presentation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  it("rejects structural canvas impostors and resets an existing connection", () => {
    const presenter = createDirectPreviewPresenter();
    const surface = createNativeCanvasFixture({
      getContext: () => ({
        clearRect: vi.fn<OffscreenCanvasRenderingContext2D["clearRect"]>(),
        drawImage: vi.fn<DrawImagePort>(),
      }),
    });
    expect(presenter.connect(surface)).toBe(true);
    const getContext = vi.fn<OffscreenCanvas["getContext"]>();
    expect(presenter.connect({ width: 1, height: 1, getContext })).toBe(false);
    expect(getContext).not.toHaveBeenCalled();
    expect(presenter.acquireRenderSurface(1, 1)).toBeNull();
    expect(presenter.present(createNativeBitmapFixture())).toBe(false);
  });

  it("transfers a rendered bitmap into the connected surface", () => {
    const transferFromImageBitmap =
      vi.fn<ImageBitmapRenderingContext["transferFromImageBitmap"]>();
    const surface = createNativeCanvasFixture({
      getContext: vi.fn<(type: string) => PreviewContextPort | null>(
        (type: string) =>
          type === "bitmaprenderer" ? { transferFromImageBitmap } : null,
      ),
      height: 1,
      width: 1,
    });
    const bitmap = createNativeBitmapFixture({ height: 90, width: 160 });
    const presenter = createDirectPreviewPresenter();

    expect(presenter.present(bitmap)).toBe(false);
    expect(presenter.canPresentReusableBitmap()).toBe(false);
    expect(presenter.connect(surface)).toBe(true);
    expect(presenter.canPresentReusableBitmap()).toBe(false);
    expect(presenter.present(bitmap)).toBe(true);
    expect(surface).toMatchObject({ height: 90, width: 160 });
    expect(transferFromImageBitmap).toHaveBeenCalledWith(bitmap);
  });

  it("prefers a reusable 2d render surface when both contexts are available", () => {
    const clearRect = vi.fn<OffscreenCanvasRenderingContext2D["clearRect"]>();
    const drawImage = vi.fn<DrawImagePort>();
    const transferFromImageBitmap =
      vi.fn<ImageBitmapRenderingContext["transferFromImageBitmap"]>();
    const surface = createNativeCanvasFixture({
      getContext: vi.fn<(type: string) => PreviewContextPort | null>(
        (type: string) =>
          type === "bitmaprenderer"
            ? { transferFromImageBitmap }
            : { clearRect, drawImage },
      ),
      height: 45,
      width: 80,
    });
    const bitmap = createNativeBitmapFixture({ height: 45, width: 80 });
    const presenter = createDirectPreviewPresenter();

    expect(presenter.connect(surface)).toBe(true);
    expect(presenter.canPresentReusableBitmap()).toBe(true);
    expect(presenter.present(bitmap)).toBe(true);
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0);
    expect(transferFromImageBitmap).not.toHaveBeenCalled();
  });

  it("can render directly into and commit the connected 2d surface", () => {
    const commit = vi.fn<() => void>();
    const context = { commit };
    const surface = createNativeCanvasFixture({
      getContext: vi.fn<(type: string) => PreviewContextPort | null>(
        (type: string) => (type === "2d" ? context : null),
      ),
      height: 45,
      width: 80,
    });
    const presenter = createDirectPreviewPresenter();

    expect(presenter.connect(surface)).toBe(true);
    expect(presenter.acquireRenderSurface(160, 90)).toBe(surface);
    expect(surface).toMatchObject({ height: 90, width: 160 });
    expect(presenter.isRenderSurface(surface)).toBe(true);
    expect(presenter.commitRenderSurface(surface)).toBe(true);
    expect(commit).toHaveBeenCalledOnce();
  });

  it("falls back to a 2d surface and closes the consumed bitmap", () => {
    const context = {
      clearRect: vi.fn<OffscreenCanvasRenderingContext2D["clearRect"]>(),
      drawImage: vi.fn<DrawImagePort>(),
    };
    const surface = createNativeCanvasFixture({
      getContext: vi.fn<(type: string) => PreviewContextPort | null>(
        (type: string) => (type === "2d" ? context : null),
      ),
      height: 1,
      width: 1,
    });
    const close = vi.fn<ImageBitmap["close"]>();
    const bitmap = createNativeBitmapFixture({
      close,
      height: 45,
      width: 80,
    });
    const presenter = createDirectPreviewPresenter();

    expect(presenter.connect(surface)).toBe(true);
    expect(presenter.canPresentReusableBitmap()).toBe(true);
    expect(presenter.present(bitmap)).toBe(true);
    expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0);
    expect(close).toHaveBeenCalledOnce();
  });

  it("falls back to a reusable 2d surface when bitmap presentation is unavailable", () => {
    const context = {
      clearRect: vi.fn<OffscreenCanvasRenderingContext2D["clearRect"]>(),
      drawImage: vi.fn<DrawImagePort>(),
    };
    const transferFromImageBitmap =
      vi.fn<ImageBitmapRenderingContext["transferFromImageBitmap"]>();
    const surface = createNativeCanvasFixture({
      getContext: vi.fn<(type: string) => PreviewContextPort | null>(
        (type: string) => (type === "2d" ? context : null),
      ),
      height: 90,
      width: 160,
    });
    const close = vi.fn<ImageBitmap["close"]>();
    const bitmap = createNativeBitmapFixture({
      close,
      height: 90,
      width: 160,
    });
    const presenter = createDirectPreviewPresenter();

    expect(presenter.connect(surface)).toBe(true);
    expect(presenter.present(bitmap, { reusable: true })).toBe(true);
    expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0);
    expect(close).not.toHaveBeenCalled();
    expect(transferFromImageBitmap).not.toHaveBeenCalled();
  });

  it("does not reset an already correctly sized presentation surface", () => {
    const context = {
      clearRect: vi.fn<OffscreenCanvasRenderingContext2D["clearRect"]>(),
      drawImage: vi.fn<DrawImagePort>(),
    };
    const setWidth = vi.fn<(value: number) => void>();
    const setHeight = vi.fn<(value: number) => void>();
    const surface = createNativeCanvasFixture({
      getContext: vi.fn<(type: string) => PreviewContextPort | null>(
        (type: string) => (type === "2d" ? context : null),
      ),
      get height() {
        return 90;
      },
      set height(value: number) {
        setHeight(value);
      },
      get width() {
        return 160;
      },
      set width(value: number) {
        setWidth(value);
      },
    });
    const presenter = createDirectPreviewPresenter();

    expect(presenter.connect(surface)).toBe(true);
    expect(
      presenter.present(createNativeBitmapFixture({ height: 90, width: 160 })),
    ).toBe(true);
    expect(setWidth).not.toHaveBeenCalled();
    expect(setHeight).not.toHaveBeenCalled();
  });
});

type PreviewContextPort =
  | (Pick<OffscreenCanvasRenderingContext2D, "clearRect"> & {
      drawImage: DrawImagePort;
    })
  | Pick<ImageBitmapRenderingContext, "transferFromImageBitmap">
  | { commit(): void };

type DrawImagePort = (
  image: Parameters<OffscreenCanvasRenderingContext2D["drawImage"]>[0],
  x: number,
  y: number,
) => void;
