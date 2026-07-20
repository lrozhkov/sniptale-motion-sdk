import { describe, expect, it } from "vitest";

import {
  createAssetLayer,
  createUniqueAssetId,
  formatAssetMeta,
  getAssetUsageCount,
  isSafeSvgAssetText,
  normalizeAuthorAssetMimeType,
  validateAuthorSvgAsset,
  withAssetLayerTypeDefaults,
} from "../src/apps/viewer/assets/model";

describe("viewer asset model", () => {
  it("infers supported mime types from file names", () => {
    expect(normalizeAuthorAssetMimeType({ name: "mark.svg", type: "" })).toBe(
      "image/svg+xml",
    );
    expect(normalizeAuthorAssetMimeType({ name: "photo.jpeg", type: "" })).toBe(
      "image/jpeg",
    );
    expect(normalizeAuthorAssetMimeType({ name: "raw.bin", type: "" })).toBe(
      "application/octet-stream",
    );
  });

  it("validates SVG text with forbidden pattern checks", () => {
    expect(isSafeSvgAssetText("<svg><path /></svg>")).toBe(true);
    expect(isSafeSvgAssetText("<svg><script /></svg>")).toBe(false);
    expect(() =>
      validateAuthorSvgAsset('<svg onload="alert(1)" />', "unsafe.svg"),
    ).toThrow("unsafe.svg is not valid SVG text");
  });

  it("creates deterministic ids, usage counts, and metadata labels", () => {
    const template = {
      layers: [
        { assetId: "asset-logo" },
        { assetId: "asset-logo" },
        { assetId: "other" },
      ],
    };

    expect(createUniqueAssetId("logo.svg", ["asset-logo"])).toBe(
      "asset-logo-2",
    );
    expect(getAssetUsageCount(template, "asset-logo")).toBe(2);
    expect(
      formatAssetMeta({
        id: "asset-logo",
        mimeType: "image/svg+xml",
        path: "logo.svg",
        width: 128.2,
        height: 64.8,
      }),
    ).toBe("image/svg+xml · 128 x 65 · logo.svg");
  });

  it("creates asset layers with canvas drop positioning and type defaults", () => {
    const layer = createAssetLayer(
      {
        height: 100,
        id: "asset-logo",
        mimeType: "image/svg+xml",
        path: "logo.svg",
        width: 400,
      },
      { layers: [{ id: "svg-asset-1", type: "svgAsset" }] },
      {
        canvasHeight: 720,
        canvasPoint: { x: 500, y: 400 },
        canvasWidth: 1280,
      },
    );

    expect(layer).toMatchObject({
      assetId: "asset-logo",
      height: 70,
      id: "svg-asset-2",
      partReveal: 1,
      type: "svgAsset",
      width: 280,
      x: -140,
      y: 40,
    });
    expect(
      withAssetLayerTypeDefaults(
        { type: "imageAsset", svgPartMode: "none" },
        "imageAsset",
      ),
    ).toEqual({ type: "imageAsset" });
  });
});
