import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import { createNativeBitmapFixture } from "./helpers/native-render-fixtures.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  calculateSvgRasterSize,
  createRenderAssets,
} from "../src/apps/viewer/rendering/assets";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("viewer render asset raster sizing", () => {
  it("downscales oversized SVG metadata to the preview raster budget", () => {
    expect(
      calculateSvgRasterSize(
        { height: 1034, width: 3343 },
        { naturalHeight: 0, naturalWidth: 0 },
      ),
    ).toEqual({ height: 557, width: 1800 });
  });

  it("caps tiny SVG upscaling without creating an oversized bitmap", () => {
    expect(
      calculateSvgRasterSize(
        { height: 18, width: 93.2 },
        { naturalHeight: 0, naturalWidth: 0 },
      ),
    ).toEqual({ height: 144, width: 746 });
  });

  it("keeps extreme SVG aspect ratios inside the long-edge budget", () => {
    expect(
      calculateSvgRasterSize(
        { height: 1, width: 10000 },
        { naturalHeight: 0, naturalWidth: 0 },
      ),
    ).toEqual({ height: 1, width: 1800 });
  });
});

describe("viewer render asset transport", () => {
  it("serializes SVG parts before a direct worker transfer", async () => {
    vi.stubGlobal(
      "DOMParser",
      class DOMParserStub {
        parseFromString() {
          const rect = svgNode("rect", {
            fill: "#fff",
            height: "10",
            id: "tile",
            width: "20",
            x: "0",
            y: "0",
          });
          return {
            documentElement: svgNode("svg", { viewBox: "0 0 20 10" }, [rect]),
            querySelector: () => null,
          };
        }
      },
    );
    const bitmap = createNativeBitmapFixture({ height: 10, width: 20 });
    const ctx = createContext(bitmap);
    ctx.state.assets.set("logo", {
      height: 10,
      id: "logo",
      kind: "svg",
      mimeType: "image/svg+xml",
      svgText: "<svg />",
      width: 20,
    });

    const result = await ctx.createRenderAssets({
      assets: ["logo"],
      id: "template",
    });

    expect(result.envelope.assets?.logo?.svgVector).toMatchObject({
      height: 10,
      parts: [{ id: "tile", type: "rect" }],
      width: 20,
    });
  });

  it("transfers each asset once per effect execution route", async () => {
    const bitmap = createNativeBitmapFixture({ height: 32, width: 64 });
    const resetBitmap = createNativeBitmapFixture({ height: 32, width: 64 });
    const routeBitmap = createNativeBitmapFixture({ height: 32, width: 64 });
    const replacementBitmap = createNativeBitmapFixture({
      height: 32,
      width: 64,
    });
    const ctx = createContext();
    ctx.createAssetBitmap
      .mockResolvedValueOnce(bitmap)
      .mockResolvedValueOnce(resetBitmap)
      .mockResolvedValueOnce(routeBitmap)
      .mockResolvedValueOnce(replacementBitmap);
    ctx.state.assets.set("logo", {
      height: 32,
      id: "logo",
      kind: "image",
      mimeType: "image/svg+xml",
      path: "logo.svg",
      width: 64,
    });
    const template = { assets: ["logo"], id: "template" };

    const first = await ctx.createRenderAssets(template);
    expect(first.transfer).toEqual([bitmap]);
    expect(first.envelope.assets?.logo?.bitmap).toBe(bitmap);

    ctx.commitRenderAssetTransfers(first);
    const second = await ctx.createRenderAssets({ ...template });
    expect(second.transfer).toEqual([]);
    expect(second.envelope).toEqual({
      renderAssetsId: first.envelope.renderAssetsId,
    });
    expect(ctx.createAssetBitmap).toHaveBeenCalledOnce();
    expect(ctx.state.assetBitmapTransfers).toBe(1);
    expect(ctx.state.assetEnvelopeTransfers).toBe(1);

    ctx.resetRenderAssetCache();
    const afterReset = await ctx.createRenderAssets(template);
    expect(afterReset.transfer).toEqual([resetBitmap]);
    expect(afterReset.envelope.assets?.logo?.bitmap).toBe(resetBitmap);
    ctx.commitRenderAssetTransfers(afterReset);

    const otherEffect = await ctx.createRenderAssets({
      assets: ["logo"],
      id: "other-template",
    });
    expect(otherEffect.transfer).toEqual([routeBitmap]);
    expect(otherEffect.envelope.renderAssetsId).not.toBe(
      first.envelope.renderAssetsId,
    );

    ctx.state.assets.set("logo", {
      height: 32,
      id: "logo",
      kind: "image",
      mimeType: "image/svg+xml",
      path: "replacement.svg",
      width: 64,
    });
    const replacement = await ctx.createRenderAssets(template);
    expect(replacement.transfer).toEqual([replacementBitmap]);
    expect(replacement.envelope.renderAssetsId).not.toBe(
      first.envelope.renderAssetsId,
    );
    expect(ctx.createAssetBitmap).toHaveBeenCalledTimes(4);
  });
});

type SvgNodeFixture = {
  children: SvgNodeFixture[];
  getAttribute(name: string): string | null;
  tagName: string;
};

function svgNode(
  tagName: string,
  attributes: Record<string, string>,
  children: SvgNodeFixture[] = [],
): SvgNodeFixture {
  return {
    children,
    getAttribute: (name: string) => attributes[name] ?? null,
    tagName,
  };
}

describe("render asset preparation failure", () => {
  it("closes prepared bitmaps on a later decode failure without committing cache state", async () => {
    const bitmap = createNativeBitmapFixture({ width: 10, height: 10 });
    const close = vi.spyOn(bitmap, "close");
    const ctx = createContext();
    ctx.state.assets.set("first", { id: "first" });
    ctx.state.assets.set("second", { id: "second" });
    ctx.createAssetBitmap
      .mockResolvedValueOnce(bitmap)
      .mockRejectedValueOnce(new Error("decode failed"));
    await expect(
      createRenderAssets(ctx, { id: "template", assets: ["first", "second"] }),
    ).rejects.toThrow("decode failed");
    expect(close).toHaveBeenCalledOnce();
    expect(ctx.state.sandboxAssetCacheKeys.size).toBe(0);
    expect(ctx.state.sandboxRenderAssetsId).toBeNull();
  });

  it("transports prototype-like asset IDs as own entries", async () => {
    const bitmap = createNativeBitmapFixture({ width: 10, height: 10 });
    const ctx = createContext(bitmap);
    ctx.state.assets.set("__proto__", { id: "__proto__" });
    const result = await createRenderAssets(ctx, {
      id: "template",
      assets: ["__proto__"],
    });
    expect(Object.hasOwn(result.envelope.assets ?? {}, "__proto__")).toBe(true);
    expect(result.envelope.assets?.["__proto__"]?.bitmap).toBe(bitmap);
    expect(Object.getPrototypeOf(result.envelope.assets)).toBe(
      Object.prototype,
    );
  });

  it("does not coerce malformed asset references or route objects", async () => {
    const coercion = vi.fn<() => never>(() => {
      throw new Error("must not coerce");
    });
    const ctx = createContext();
    const result = await createRenderAssets(ctx, {
      id: { toString: coercion },
      assets: ["missing", { toString: coercion }, null, 42],
    });
    expect(result.transfer).toEqual([]);
    expect(coercion).not.toHaveBeenCalled();
    expect(ctx.state.renderAssetSelection?.routeId).toBe("effect");
  });

  it("uses finite intrinsic dimensions when optional SVG metadata is invalid", () => {
    expect(
      calculateSvgRasterSize(
        { width: NaN, height: Infinity },
        { naturalWidth: 200, naturalHeight: 100 },
      ),
    ).toEqual({ width: 1600, height: 800 });
    expect(
      calculateSvgRasterSize(
        { width: -1, height: 0 },
        { naturalWidth: 0, naturalHeight: 0 },
      ),
    ).toEqual({ width: 1800, height: 1800 });
  });
});

function createContext(bitmap?: ImageBitmap) {
  const ctx = createViewerContextFixture();
  vi.spyOn(ctx, "logDiagnostic").mockImplementation(() => {});
  const createAssetBitmap = vi.spyOn(ctx, "createAssetBitmap");
  if (bitmap) createAssetBitmap.mockResolvedValue(bitmap);
  else
    createAssetBitmap.mockRejectedValue(
      new Error("Unexpected asset bitmap decode."),
    );
  return Object.assign(ctx, { createAssetBitmap });
}
