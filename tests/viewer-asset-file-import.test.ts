import { createNativeBitmapFixture } from "./helpers/native-render-fixtures.js";
import { responseString } from "../tooling/test/fixtures/response.js";
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

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("author asset file boundary", () => {
  for (const outcome of [
    "error",
    "abort",
    "unexpected-result",
    "success",
  ] as const) {
    it(`closes the decoded bitmap on FileReader ${outcome}`, async () => {
      const close = vi.fn<() => void>();
      const bitmap = createNativeBitmapFixture({ width: 8, height: 4, close });
      vi.stubGlobal(
        "createImageBitmap",
        vi.fn<typeof globalThis.createImageBitmap>(async () => bitmap),
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
        createAssetBitmap: vi.fn<
          Parameters<typeof createAuthorAssetFromFile>[0]["createAssetBitmap"]
        >(async () => bitmap),
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
      const actual = await pending.then(
        (asset) => ({ asset, error: "" }),
        (error: unknown) => ({
          asset: null,
          error: responseString(error, "message"),
        }),
      );
      const fields =
        actual.asset === null
          ? null
          : {
              id: actual.asset.id,
              width: actual.asset.width,
              height: actual.asset.height,
              dataUrl: actual.asset.dataUrl,
            };
      expect(fields).toEqual(
        outcome === "success"
          ? {
              id: "asset-image",
              width: 8,
              height: 4,
              dataUrl: "data:image/png;base64,AA==",
            }
          : null,
      );
      expect(actual.error).toMatch(
        outcome === "success" ? /^$/ : /failed to read/,
      );
      expect(close).toHaveBeenCalledOnce();
    });
  }

  for (const change of ["source", "asset", "none"] as const) {
    it(`checks replacement authority after asynchronous decode: ${change}`, async () => {
      const previous: ViewerAsset = { id: "image", path: "previous.png" };
      const next: ViewerAsset = { id: "image", path: "next.png" };
      const decoded = Promise.withResolvers<ViewerAsset>();
      const assets = new Map([[previous.id, previous]]);
      const replaceAsset =
        vi.fn<Parameters<typeof replaceSelectedAssetFile>[0]["replaceAsset"]>();
      const ctx: Parameters<typeof replaceSelectedAssetFile>[0] = {
        state: { currentTemplate: {}, pendingAssetReplaceId: "image", assets },
        refs: {
          replaceAssetInput: {
            files: [new File(["next"], "next.png")],
            value: "next.png",
          },
          timelineSaveStatus: { textContent: "" },
        },
        createAuthorAssetFromFile: vi.fn<
          Parameters<
            typeof replaceSelectedAssetFile
          >[0]["createAuthorAssetFromFile"]
        >(() => decoded.promise),
        replaceAsset,
        logDiagnostic: vi.fn<(message: string, level?: string) => void>(),
      };
      const pending = replaceSelectedAssetFile(ctx);
      if (change === "source") ctx.state.currentTemplate = {};
      if (change === "asset")
        assets.set("image", { ...previous, path: "renamed.png" });
      decoded.resolve(next);
      await pending;
      expect(replaceAsset.mock.calls).toEqual(
        change === "none" ? [[next]] : [],
      );
      expect(ctx.state.pendingAssetReplaceId).toBeNull();
      expect(ctx.refs.replaceAssetInput.value).toBe("");
    });
  }
});
