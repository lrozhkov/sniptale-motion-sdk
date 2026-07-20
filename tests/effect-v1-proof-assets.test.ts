import { describe, expect, it } from "vitest";

import { createEffectV1AssetMaterializationProof } from "../tooling/effect-v1/proof-assets.js";

describe("Effect v1 asset materialization proof", () => {
  it("requires imported visual assets to cross the sandbox boundary", () => {
    expect(
      createEffectV1AssetMaterializationProof(
        {
          assets: [{ id: "mark", kind: "svg", mimeType: "image/svg+xml" }],
        },
        { assetBitmapTransfers: 2, assetEnvelopeTransfers: 3 },
        { assetBitmapTransfers: 3, assetEnvelopeTransfers: 4 },
        "Runtime ready",
      ),
    ).toEqual({
      bitmapTransfers: 1,
      declared: ["mark"],
      envelopeTransfers: 1,
      ok: true,
      unknownAsset: false,
      visual: ["mark"],
    });
  });

  it("rejects missing transfers and unknown-asset diagnostics", () => {
    const document = {
      assets: [{ id: "mark", kind: "svg", mimeType: "image/svg+xml" }],
    };
    expect(
      createEffectV1AssetMaterializationProof(
        document,
        { assetBitmapTransfers: 1, assetEnvelopeTransfers: 1 },
        { assetBitmapTransfers: 1, assetEnvelopeTransfers: 1 },
        "unknown asset mark",
      ),
    ).toMatchObject({ ok: false, unknownAsset: true });
  });

  it("does not demand bitmap transfers for documents without visual assets", () => {
    expect(
      createEffectV1AssetMaterializationProof(
        { assets: [{ id: "voice", kind: "audio", mimeType: "audio/ogg" }] },
        {},
        {},
        "",
      ),
    ).toMatchObject({ declared: ["voice"], ok: true, visual: [] });
  });
});
