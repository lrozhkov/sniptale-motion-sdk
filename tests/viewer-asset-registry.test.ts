import { describe, expect, it, vi } from "vitest";
import { readViewerAsset } from "../src/apps/viewer/assets/state";
import { prepareImportedAssets } from "../src/apps/viewer/assets/layer-binding";

describe("viewer asset registry boundary", () => {
  it("preserves metadata-only history entries and materialized asset identity", () => {
    const metadata = { id: "image", path: "base.png" };
    const materialized = {
      ...metadata,
      blob: new Blob(["image"]),
      width: 20,
      height: null,
      dataUrl: null,
    };
    expect(readViewerAsset(metadata)).toBe(metadata);
    expect(readViewerAsset(materialized)).toBe(materialized);
  });

  it.each([
    null,
    [],
    {},
    { id: 7 },
    { id: "image", width: "20" },
    { id: "image", width: Infinity },
    { id: "image", byteLength: null },
    { id: "image", blob: {} },
    { id: "image", path: {} },
  ])("rejects malformed registry metadata %j", (value) => {
    expect(readViewerAsset(value)).toBeNull();
  });

  it("materializes validated import metadata without coercing dimensions", () => {
    const blob = new Blob(["image"]);
    const dataUrlToBlob = vi.fn<() => Blob>(() => blob);
    const asset = {
      id: "image",
      dataUrl: "data:image/png;base64,YQ==",
      mimeType: "image/png",
      width: null,
      height: 20,
    };
    const prepared = prepareImportedAssets({ dataUrlToBlob }, [asset]);
    expect(prepared.get("image")).toMatchObject({
      blob,
      byteLength: blob.size,
      width: null,
      height: 20,
    });
    expect(asset.width).toBeNull();
    expect(() =>
      prepareImportedAssets({ dataUrlToBlob }, [{ ...asset, width: "20" }]),
    ).toThrow("invalid metadata");
    expect(() =>
      prepareImportedAssets({ dataUrlToBlob }, [asset, asset]),
    ).toThrow("Duplicate imported asset");
  });
});
