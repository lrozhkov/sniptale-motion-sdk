import { MAX_ASSET_BYTES } from "../src/sdk/protocol.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAuthorAssetFromFile,
  replaceSelectedAssetFile,
} from "../src/apps/viewer/assets/file-import.js";
import {
  normalizeAuthorAssetMimeType,
  createUniqueAssetId,
  validateAuthorSvgAsset,
} from "../src/apps/viewer/assets/model.js";
import { SUPPORTED_AUTHOR_ASSET_TYPES } from "../src/apps/viewer/app/constants.js";
import type { ViewerAsset } from "../src/apps/viewer/assets/state.js";

afterEach(() => vi.unstubAllGlobals());

describe("author asset file boundary", () => {
  for (const outcome of [
    "error",
    "abort",
    "unexpected-result",
    "success",
  ] as const) {
    it(`closes the decoded bitmap on FileReader ${outcome}`, async () => {
      const close = vi.fn<() => void>();
      const bitmap: ImageBitmap = { width: 8, height: 4, close };
      vi.stubGlobal(
        "createImageBitmap",
        vi.fn(async () => bitmap),
      );
      vi.stubGlobal(
        "FileReader",
        class {
          result: unknown =
            outcome === "unexpected-result"
              ? new ArrayBuffer(1)
              : "data:image/png;base64,AA==";
          onload: (() => void) | null = null;
          onerror: (() => void) | null = null;
          onabort: (() => void) | null = null;
          readAsDataURL() {
            if (outcome === "error") this.onerror?.();
            else if (outcome === "abort") this.onabort?.();
            else this.onload?.();
          }
        },
      );
      const ctx: Parameters<typeof createAuthorAssetFromFile>[0] = {
        createAssetBitmap: vi.fn(async () => bitmap),
        state: { assets: new Map() },
        deps: {
          normalizeAuthorAssetMimeType,
          createUniqueAssetId,
          validateAuthorSvgAsset,
          MAX_ASSET_BYTES,
          SUPPORTED_AUTHOR_ASSET_TYPES,
        },
      };
      const pending = createAuthorAssetFromFile(
        ctx,
        new File(["image"], "image.png", { type: "image/png" }),
      );
      if (outcome === "success")
        await expect(pending).resolves.toMatchObject({
          id: "asset-image",
          width: 8,
          height: 4,
          dataUrl: "data:image/png;base64,AA==",
        });
      else await expect(pending).rejects.toThrow(/failed to read/);
      expect(close).toHaveBeenCalledOnce();
    });
  }

  for (const change of ["source", "asset", "none"] as const) {
    it(`checks replacement authority after asynchronous decode: ${change}`, async () => {
      const previous: ViewerAsset = { id: "image", path: "previous.png" };
      const next: ViewerAsset = { id: "image", path: "next.png" };
      const decoded = Promise.withResolvers<ViewerAsset>();
      const assets = new Map([[previous.id, previous]]);
      const ctx: Parameters<typeof replaceSelectedAssetFile>[0] = {
        state: { currentTemplate: {}, pendingAssetReplaceId: "image", assets },
        refs: {
          replaceAssetInput: {
            files: [new File(["next"], "next.png")],
            value: "next.png",
          },
          timelineSaveStatus: { textContent: "" },
        },
        createAuthorAssetFromFile: vi.fn(() => decoded.promise),
        replaceAsset: vi.fn<(asset: ViewerAsset) => void>(),
        logDiagnostic: vi.fn<(message: string, level?: string) => void>(),
      };
      const pending = replaceSelectedAssetFile(ctx);
      if (change === "source") ctx.state.currentTemplate = {};
      if (change === "asset")
        assets.set("image", { ...previous, path: "renamed.png" });
      decoded.resolve(next);
      await pending;
      if (change === "none")
        expect(ctx.replaceAsset).toHaveBeenCalledWith(next);
      else expect(ctx.replaceAsset).not.toHaveBeenCalled();
      expect(ctx.state.pendingAssetReplaceId).toBeNull();
      expect(ctx.refs.replaceAssetInput.value).toBe("");
    });
  }
});
