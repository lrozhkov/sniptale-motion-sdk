import { describe, expect, it, vi } from "vitest";

import {
  calculateSvgRasterSize,
  installRenderingAssetsOwner,
} from "../src/apps/viewer/rendering/assets";

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
    const previousDomParser = globalThis.DOMParser;
    globalThis.DOMParser = class DOMParserStub {
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
    } as any;
    try {
      const bitmap = { height: 10, width: 20 };
      const ctx: any = {
        logDiagnostic: vi.fn(),
        state: {
          assets: new Map([
            [
              "logo",
              {
                height: 10,
                id: "logo",
                kind: "svg",
                mimeType: "image/svg+xml",
                svgText: "<svg />",
                width: 20,
              },
            ],
          ]),
          renderAssetSelection: null,
          sandboxAssetCacheKeys: new Set(),
          sandboxRenderAssetsId: null,
        },
      };
      installRenderingAssetsOwner(ctx);
      ctx.createAssetBitmap = vi.fn(async () => bitmap);

      const result = await ctx.createRenderAssets({
        assets: ["logo"],
        id: "template",
      });

      expect(result.envelope.assets.logo.svgVector).toMatchObject({
        height: 10,
        parts: [{ id: "tile", type: "rect" }],
        width: 20,
      });
    } finally {
      globalThis.DOMParser = previousDomParser;
    }
  });

  it("transfers each asset once per effect execution route", async () => {
    const bitmap = { height: 32, width: 64 };
    const ctx: any = {
      logDiagnostic: vi.fn(),
      state: {
        assetBitmapTransfers: 0,
        assetEnvelopeTransfers: 0,
        assets: new Map([
          [
            "logo",
            {
              height: 32,
              id: "logo",
              kind: "image",
              mimeType: "image/svg+xml",
              path: "logo.svg",
              width: 64,
            },
          ],
        ]),
        renderAssetSelection: null,
        sandboxAssetCacheKeys: new Set(),
        sandboxRenderAssetsId: null,
      },
    };
    installRenderingAssetsOwner(ctx);
    ctx.createAssetBitmap = vi.fn(async () => bitmap);
    const template = { assets: ["logo"], id: "template" };

    const first = await ctx.createRenderAssets(template);
    expect(first.transfer).toEqual([bitmap]);
    expect(first.envelope.assets.logo.bitmap).toBe(bitmap);

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
    expect(afterReset.transfer).toEqual([bitmap]);
    expect(afterReset.envelope.assets.logo.bitmap).toBe(bitmap);
    ctx.commitRenderAssetTransfers(afterReset);

    const otherEffect = await ctx.createRenderAssets({
      assets: ["logo"],
      id: "other-template",
    });
    expect(otherEffect.transfer).toEqual([bitmap]);
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
    expect(replacement.transfer).toEqual([bitmap]);
    expect(replacement.envelope.renderAssetsId).not.toBe(
      first.envelope.renderAssetsId,
    );
  });
});

function svgNode(
  tagName: string,
  attributes: Record<string, string>,
  children: any[] = [],
) {
  return {
    children,
    getAttribute: (name: string) => attributes[name] ?? null,
    tagName,
  };
}
