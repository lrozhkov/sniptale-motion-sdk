import { createNativeBitmapFixture } from "./helpers/native-render-fixtures.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createViewerState } from "../src/apps/viewer/app/state";
import {
  commitRenderAssetTransfers,
  createRenderAssets,
} from "../src/apps/viewer/rendering/assets";
import { createSvgDataUrl } from "../src/shared/svg-data-url";

describe("render asset version leases", () => {
  it("resends an old asset after replacement and undo rather than using an evicted descriptor", async () => {
    const state = createViewerState();
    const bitmap = createNativeBitmapFixture({ width: 10, height: 10 });
    const ctx = {
      state,
      createAssetBitmap: vi.fn<
        Parameters<typeof createRenderAssets>[0]["createAssetBitmap"]
      >(async () => bitmap),
      logDiagnostic:
        vi.fn<Parameters<typeof createRenderAssets>[0]["logDiagnostic"]>(),
    };
    const original = { id: "logo", mimeType: "image/png" };
    const replacement = { id: "logo", mimeType: "image/png" };
    state.assets.set("logo", original);
    const template = { id: "sample", assets: ["logo"] };
    const first = await createRenderAssets(ctx, template);
    commitRenderAssetTransfers(ctx, first);
    state.assets.set("logo", replacement);
    const second = await createRenderAssets(ctx, template);
    commitRenderAssetTransfers(ctx, second);
    expect(state.sandboxAssetCacheKeys.has(first.cacheKeys[0] ?? "")).toBe(
      false,
    );
    expect(state.sandboxAssetVersions.size).toBe(1);
    state.assets.set("logo", original);
    const undo = await createRenderAssets(ctx, template);
    expect(undo.transfer).toEqual([bitmap]);
    expect(ctx.createAssetBitmap).toHaveBeenCalledTimes(3);
  });

  it("retires removed global assets and ignores acknowledgements from an old runtime", async () => {
    const state = createViewerState();
    const bitmap = createNativeBitmapFixture({ width: 10, height: 10 });
    const ctx = {
      state,
      createAssetBitmap: vi.fn<
        Parameters<typeof createRenderAssets>[0]["createAssetBitmap"]
      >(async () => bitmap),
      logDiagnostic:
        vi.fn<Parameters<typeof createRenderAssets>[0]["logDiagnostic"]>(),
    };
    state.assets.set("old", { id: "old" });
    const first = await createRenderAssets(ctx, {
      id: "sample",
      assets: ["old"],
    });
    commitRenderAssetTransfers(ctx, first);
    state.assets.delete("old");
    state.assets.set("new", { id: "new" });
    const next = await createRenderAssets(ctx, {
      id: "sample",
      assets: ["new"],
    });
    commitRenderAssetTransfers(ctx, next);
    expect(next.envelope.retainedAssetIds).toEqual(["new"]);
    expect(state.sandboxAssetVersions.has("old")).toBe(false);
    expect(state.sandboxAssetCacheKeys.has(first.cacheKeys[0] ?? "")).toBe(
      false,
    );
    state.sandboxRuntimeGeneration += 1;
    state.sandboxAssetCacheKeys.clear();
    commitRenderAssetTransfers(ctx, next);
    expect(state.sandboxAssetCacheKeys.size).toBe(0);
  });

  it("invalidates leases after a stale selection acknowledgement", async () => {
    const state = createViewerState();
    const bitmap = createNativeBitmapFixture({ width: 10, height: 10 });
    const ctx = {
      state,
      createAssetBitmap: vi.fn<
        Parameters<typeof createRenderAssets>[0]["createAssetBitmap"]
      >(async () => bitmap),
      logDiagnostic:
        vi.fn<Parameters<typeof createRenderAssets>[0]["logDiagnostic"]>(),
    };
    state.assets.set("logo", { id: "logo" });
    const first = await createRenderAssets(ctx, {
      id: "first",
      assets: ["logo"],
    });
    const second = await createRenderAssets(ctx, {
      id: "second",
      assets: ["logo"],
    });
    commitRenderAssetTransfers(ctx, second);
    commitRenderAssetTransfers(ctx, first);
    expect(state.sandboxAssetCacheKeys.size).toBe(0);
    expect(state.sandboxRenderAssetsId).toBeNull();
  });
});

describe("SVG text data URL", () => {
  it("encodes Russian and Unicode source as UTF-8 without changing the SVG", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><text>Привет 🌙</text></svg>';
    const encoded = createSvgDataUrl(svg).split(",")[1] ?? "";
    const bytes = Uint8Array.from(atob(encoded), (character) =>
      character.charCodeAt(0),
    );
    expect(new TextDecoder().decode(bytes)).toBe(svg);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
