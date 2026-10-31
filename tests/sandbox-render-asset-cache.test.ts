import { describe, expect, it, vi } from "vitest";

import { createRenderAssetCache } from "../src/apps/sandbox/runtime/render-asset-cache";
import { closeAssetBitmaps } from "../src/apps/sandbox/runtime/render-assets";

describe("sandbox render asset cache", () => {
  it("reuses an acknowledged bitmap without another cross-frame transfer", () => {
    const cache = createRenderAssetCache();
    const bitmap = createBitmap();
    const first = cache.resolve({
      logo: createAsset({ bitmap, cacheKey: "logo-v1" }),
    });
    const second = cache.resolve({
      logo: createAsset({ cacheKey: "logo-v1" }),
    });

    expect(first.logo.bitmap).toBe(bitmap);
    expect(second.logo.bitmap).toBe(bitmap);
    expect(second.logo.path).toBe("logo.svg");
    expect(second.logo.width).toBe(64);
    expect(cache.size()).toBe(1);
    expect(bitmap.close).not.toHaveBeenCalled();

    cache.close();
    expect(bitmap.close).toHaveBeenCalledOnce();
  });

  it("reuses the validated asset selection without another descriptor payload", () => {
    const cache = createRenderAssetCache();
    const bitmap = createBitmap();
    const first = cache.resolve(
      { logo: createAsset({ bitmap, cacheKey: "logo-v1" }) },
      "render-assets-1",
    );

    expect(cache.resolve(undefined, "render-assets-1")).toBe(first);
    expect(() => cache.resolve(undefined, "render-assets-missing")).toThrow(
      "Missing cached render asset set render-assets-missing.",
    );
  });

  it("closes a superseded bitmap and rejects unknown cache references", () => {
    const cache = createRenderAssetCache();
    const previous = createBitmap();
    const replacement = createBitmap();
    cache.resolve({
      logo: createAsset({ bitmap: previous, cacheKey: "logo-v1" }),
    });
    cache.resolve({
      logo: createAsset({ bitmap: replacement, cacheKey: "logo-v1" }),
    });

    expect(previous.close).toHaveBeenCalledOnce();
    expect(() =>
      cache.resolve({
        mark: createAsset({ cacheKey: "mark-v1", id: "mark" }),
      }),
    ).toThrow("Missing cached bitmap for asset mark.");
  });

  it("retains prototype-like IDs through bitmap and descriptor-only selections", () => {
    const cache = createRenderAssetCache();
    const bitmap = createBitmap();
    const first = cache.resolve(
      Object.fromEntries([
        [
          "__proto__",
          createAsset({ bitmap, cacheKey: "prototype-v1", id: "__proto__" }),
        ],
      ]),
      "selection-1",
    );
    expect(Object.hasOwn(first, "__proto__")).toBe(true);
    expect(first["__proto__"]?.bitmap).toBe(bitmap);
    expect(Object.getPrototypeOf(first)).toBe(Object.prototype);
    const second = cache.resolve(
      Object.fromEntries([
        [
          "__proto__",
          createAsset({ cacheKey: "prototype-v1", id: "__proto__" }),
        ],
      ]),
      "selection-2",
    );
    expect(second["__proto__"]?.bitmap).toBe(bitmap);
    expect(cache.resolve(undefined, "selection-2")).toBe(second);
    cache.close();
    expect(bitmap.close).toHaveBeenCalledOnce();
  });

  it("validates asset payloads at the sandbox boundary", () => {
    const cache = createRenderAssetCache();

    expect(() =>
      cache.resolve({
        logo: { bitmap: createBitmap(), cacheKey: "logo-v1", id: "mark" },
      }),
    ).toThrow("Render asset id mismatch for logo.");
  });
});

describe("sandbox transferred bitmap cleanup", () => {
  it("closes direct transition frames and wrapped asset bitmaps", () => {
    const previous = createBitmap();
    const next = createBitmap();
    const asset = createBitmap();

    closeAssetBitmaps({ previous, next });
    closeAssetBitmaps({ logo: { bitmap: asset } });

    expect(previous.close).toHaveBeenCalledOnce();
    expect(next.close).toHaveBeenCalledOnce();
    expect(asset.close).toHaveBeenCalledOnce();
  });
});

function createAsset({
  bitmap,
  cacheKey,
  id = "logo",
}: {
  bitmap?: ReturnType<typeof createBitmap>;
  cacheKey: string;
  id?: string;
}) {
  return {
    ...(bitmap ? { bitmap } : {}),
    cacheKey,
    height: 32,
    id,
    kind: "image",
    mimeType: "image/svg+xml",
    path: `${id}.svg`,
    width: 64,
  };
}

function createBitmap() {
  return {
    close: vi.fn(),
    height: 32,
    width: 64,
  };
}
