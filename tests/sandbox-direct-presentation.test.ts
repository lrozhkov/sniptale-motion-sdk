import { describe, expect, it, vi } from "vitest";

import { createDirectPreviewPresenter } from "../src/apps/sandbox/runtime/direct-presentation";

describe("sandbox direct preview presentation", () => {
  it("transfers a rendered bitmap into the connected surface", () => {
    const transferFromImageBitmap = vi.fn();
    const surface = {
      getContext: vi.fn((type: string) =>
        type === "bitmaprenderer" ? { transferFromImageBitmap } : null,
      ),
      height: 1,
      width: 1,
    };
    const bitmap = { height: 90, width: 160 } as ImageBitmap;
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
    const clearRect = vi.fn();
    const drawImage = vi.fn();
    const transferFromImageBitmap = vi.fn();
    const surface = {
      getContext: vi.fn((type: string) =>
        type === "bitmaprenderer"
          ? { transferFromImageBitmap }
          : { clearRect, drawImage },
      ),
      height: 45,
      width: 80,
    };
    const bitmap = { height: 45, width: 80 } as ImageBitmap;
    const presenter = createDirectPreviewPresenter();

    expect(presenter.connect(surface)).toBe(true);
    expect(presenter.canPresentReusableBitmap()).toBe(true);
    expect(presenter.present(bitmap)).toBe(true);
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0);
    expect(transferFromImageBitmap).not.toHaveBeenCalled();
  });

  it("can render directly into and commit the connected 2d surface", () => {
    const commit = vi.fn();
    const context = { commit };
    const surface = {
      getContext: vi.fn((type: string) => (type === "2d" ? context : null)),
      height: 45,
      width: 80,
    };
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
      clearRect: vi.fn(),
      drawImage: vi.fn(),
    };
    const surface = {
      getContext: vi.fn((type: string) => (type === "2d" ? context : null)),
      height: 1,
      width: 1,
    };
    const bitmap = {
      close: vi.fn(),
      height: 45,
      width: 80,
    } as unknown as ImageBitmap;
    const presenter = createDirectPreviewPresenter();

    expect(presenter.connect(surface)).toBe(true);
    expect(presenter.canPresentReusableBitmap()).toBe(true);
    expect(presenter.present(bitmap)).toBe(true);
    expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0);
    expect(bitmap.close).toHaveBeenCalledOnce();
  });

  it("falls back to a reusable 2d surface when bitmap presentation is unavailable", () => {
    const context = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
    };
    const transferFromImageBitmap = vi.fn();
    const surface = {
      getContext: vi.fn((type: string) => (type === "2d" ? context : null)),
      height: 90,
      width: 160,
    };
    const bitmap = {
      close: vi.fn(),
      height: 90,
      width: 160,
    } as unknown as ImageBitmap;
    const presenter = createDirectPreviewPresenter();

    expect(presenter.connect(surface)).toBe(true);
    expect(presenter.present(bitmap, { reusable: true })).toBe(true);
    expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0);
    expect(bitmap.close).not.toHaveBeenCalled();
    expect(transferFromImageBitmap).not.toHaveBeenCalled();
  });

  it("does not reset an already correctly sized presentation surface", () => {
    const context = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
    };
    const setWidth = vi.fn();
    const setHeight = vi.fn();
    const surface = {
      getContext: vi.fn((type: string) => (type === "2d" ? context : null)),
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
    };
    const presenter = createDirectPreviewPresenter();

    expect(presenter.connect(surface)).toBe(true);
    expect(presenter.present({ height: 90, width: 160 } as ImageBitmap)).toBe(
      true,
    );
    expect(setWidth).not.toHaveBeenCalled();
    expect(setHeight).not.toHaveBeenCalled();
  });
});
