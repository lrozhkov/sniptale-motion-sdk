import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import { createNativeBitmapFixture } from "./helpers/native-render-fixtures.js";
import { createDrawingContextFixture } from "./helpers/drawing-context-fixture.js";
import type { ViewerAppContext } from "../src/apps/viewer/app/context.js";
import { createStarterDocument } from "../src/apps/cli/starter.js";
import { createInputFrames } from "../src/sdk/sample-scene";
import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateScaledRenderSize } from "../src/apps/viewer/rendering/preview-quality";
const transition = {
  effectV1: createStarterDocument("transition", "transition"),
};
function createContext(
  createPreviewMediaFrame: ViewerAppContext["createPreviewMediaFrame"],
  fallback?: ViewerAppContext["deps"]["createInputFrames"],
) {
  const ctx = createViewerContextFixture();
  vi.spyOn(ctx, "createPreviewMediaFrame").mockImplementation(
    createPreviewMediaFrame,
  );
  const createInputFrames = vi.spyOn(ctx.deps, "createInputFrames");
  if (fallback) createInputFrames.mockImplementation(fallback);
  else
    createInputFrames.mockRejectedValue(
      new Error("Unexpected fallback frame allocation."),
    );
  return ctx;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("render input ownership", () => {
  it("transfers an aliased bitmap once", async () => {
    const bitmap = createBitmap();
    const ctx = createContext(async () => bitmap);
    const result = await ctx.createRenderInputFrames(transition, 1280, 720, 0);
    expect(result.frames).toEqual({ from: bitmap, to: bitmap });
    expect(result.transfer).toEqual([bitmap]);
    expect(bitmap.close).not.toHaveBeenCalled();
  });
  it("waits for pending slot creation and closes its result after another slot fails", async () => {
    const bitmap = createBitmap();
    const { promise: delayed, resolve: complete } =
      Promise.withResolvers<ImageBitmap | null>();
    const failure = new Error("slot failed");
    const ctx = createContext((slot) =>
      slot === "from" ? Promise.reject(failure) : delayed,
    );
    const outcome = ctx
      .createRenderInputFrames(transition, 1280, 720, 0)
      .catch((error: unknown) => error);
    complete(bitmap);
    expect(await outcome).toBe(failure);
    expect(bitmap.close).toHaveBeenCalledOnce();
  });
  it("closes custom frames if fallback creation fails", async () => {
    const bitmap = createBitmap();
    const failure = new Error("fallback failed");
    const ctx = createContext(
      async (slot) => (slot === "from" ? bitmap : null),
      async () => {
        throw failure;
      },
    );
    await expect(
      ctx.createRenderInputFrames(transition, 1280, 720, 0),
    ).rejects.toBe(failure);
    expect(bitmap.close).toHaveBeenCalledOnce();
  });
  it("closes unused fallback frames and leaves transferred frames owned by the caller", async () => {
    const from = createBitmap(),
      previous = createBitmap(),
      next = createBitmap();
    const ctx = createContext(
      async (slot) => (slot === "from" ? from : null),
      async () => ({ previous, next }),
    );
    const result = await ctx.createRenderInputFrames(transition, 1280, 720, 0);
    expect(result.transfer).toEqual([from, next]);
    expect(previous.close).toHaveBeenCalledOnce();
    expect(from.close).not.toHaveBeenCalled();
    expect(next.close).not.toHaveBeenCalled();
  });
  it("does not create frames for standalone effects", async () => {
    const custom = vi
        .fn<ViewerAppContext["createPreviewMediaFrame"]>()
        .mockResolvedValue(null),
      fallback = vi
        .fn<ViewerAppContext["deps"]["createInputFrames"]>()
        .mockRejectedValue(new Error("Unexpected standalone fallback."));
    expect(
      await createContext(custom, fallback).createRenderInputFrames(
        {},
        1280,
        720,
        0,
      ),
    ).toEqual({ frames: {}, transfer: [] });
    expect(custom).not.toHaveBeenCalled();
    expect(fallback).not.toHaveBeenCalled();
  });
});
describe("render size boundary", () => {
  it.each([0, -1, Infinity, NaN, "1280", true])(
    "rejects invalid dimensions before arithmetic: %j",
    (width) => {
      expect(() => calculateScaledRenderSize(width, 720, 0.5)).toThrow(
        RangeError,
      );
    },
  );
});

describe("fallback frame allocation", () => {
  it("closes the first bitmap if the second allocation fails", async () => {
    const first = createBitmap();
    const failure = new Error("bitmap allocation failed");
    const drawing = createDrawingContextFixture(128, 72);
    vi.stubGlobal(
      "CanvasGradient",
      class {
        addColorStop(): void {}
      },
    );
    drawing.createLinearGradient = () => new CanvasGradient();
    vi.stubGlobal(
      "OffscreenCanvas",
      class {
        constructor(
          public width: number,
          public height: number,
        ) {}
        getContext() {
          return drawing;
        }
      },
    );
    vi.stubGlobal(
      "createImageBitmap",
      vi
        .fn<typeof createImageBitmap>()
        .mockResolvedValueOnce(first)
        .mockRejectedValueOnce(failure),
    );
    try {
      await expect(createInputFrames(128, 72, 0)).rejects.toBe(failure);
      expect(first.close).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

function createBitmap() {
  const bitmap = createNativeBitmapFixture();
  return Object.assign(bitmap, { close: vi.spyOn(bitmap, "close") });
}
