import { describe, expect, it } from "vitest";

import { buildAssetPanelItems } from "../src/apps/viewer/assets/panel";

describe("viewer asset panel view model", () => {
  it("builds selected, missing, usage, and metadata item state", () => {
    const items = buildAssetPanelItems({
      assets: new Map([
        [
          "asset-logo",
          {
            dataUrl: "data:image/png;base64,AA==",
            height: 64,
            id: "asset-logo",
            kind: "image",
            mimeType: "image/png",
            path: "logo.png",
            width: 128,
          },
        ],
      ]),
      effectiveTemplate: {
        assets: ["asset-logo", "asset-missing"],
        layers: [
          { assetId: "asset-logo" },
          { assetId: "asset-logo" },
          { assetId: "other" },
        ],
      },
      selectedItem: { assetId: "asset-logo", type: "asset" },
    });

    expect(items).toMatchObject([
      {
        assetId: "asset-logo",
        draggable: true,
        meta: "image/png · 128 x 64 · logo.png · used 2",
        missing: false,
        pathValue: "logo.png",
        previewUrl: "data:image/png;base64,AA==",
        selected: true,
        usageCount: 2,
      },
      {
        assetId: "asset-missing",
        draggable: false,
        meta: "missing asset",
        missing: true,
        pathValue: "asset-missing",
        previewUrl: null,
        selected: false,
        usageCount: 0,
      },
    ]);
  });
});
