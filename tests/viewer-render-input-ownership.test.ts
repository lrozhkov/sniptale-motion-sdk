import { createInputFrames } from "../src/sdk/sample-scene";
import { describe, expect, it, vi } from "vitest";
import { createRenderInputActions } from "../src/apps/viewer/rendering/input-frames";
import { calculateScaledRenderSize } from "../src/apps/viewer/rendering/preview-quality";
const transition = { effectV1: { kind: "transition" } };
function context(
  createPreviewMediaFrame: unknown,
  createInputFrames = vi.fn(),
) {
  const ctx = { createPreviewMediaFrame, deps: { createInputFrames } } as any;
  Object.assign(
    ctx,
    createRenderInputActions(() => ctx),
  );
  return ctx;
}
describe("render input ownership", () => {
  it("transfers an aliased bitmap once", async () => {
    const bitmap = { close: vi.fn() };
    const ctx = context(vi.fn(async () => bitmap));
    const result = await ctx.createRenderInputFrames(transition, 1280, 720, 0);
    expect(result.frames).toEqual({ from: bitmap, to: bitmap });
    expect(result.transfer).toEqual([bitmap]);
    expect(bitmap.close).not.toHaveBeenCalled();
  });
  it("waits for pending slot creation and closes its result after another slot fails", async () => {
    const bitmap = { close: vi.fn() };
    let complete: (value: unknown) => void = () => {};
    const delayed = new Promise((resolve) => {
      complete = resolve;
    });
    const failure = new Error("slot failed");
    const ctx = context(
      vi.fn((slot) => (slot === "from" ? Promise.reject(failure) : delayed)),
    );
    const outcome = ctx
      .createRenderInputFrames(transition, 1280, 720, 0)
      .catch((error: unknown) => error);
    complete(bitmap);
    expect(await outcome).toBe(failure);
    expect(bitmap.close).toHaveBeenCalledOnce();
  });
  it("closes custom frames if fallback creation fails", async () => {
    const bitmap = { close: vi.fn() };
    const failure = new Error("fallback failed");
    const ctx = context(
      vi.fn(async (slot) => (slot === "from" ? bitmap : null)),
      vi.fn(async () => {
        throw failure;
      }),
    );
    await expect(
      ctx.createRenderInputFrames(transition, 1280, 720, 0),
    ).rejects.toBe(failure);
    expect(bitmap.close).toHaveBeenCalledOnce();
  });
  it("closes unused fallback frames and leaves transferred frames owned by the caller", async () => {
    const from = { close: vi.fn() },
      previous = { close: vi.fn() },
      next = { close: vi.fn() };
    const ctx = context(
      vi.fn(async (slot) => (slot === "from" ? from : null)),
      vi.fn(async () => ({ previous, next })),
    );
    const result = await ctx.createRenderInputFrames(transition, 1280, 720, 0);
    expect(result.transfer).toEqual([from, next]);
    expect(previous.close).toHaveBeenCalledOnce();
    expect(from.close).not.toHaveBeenCalled();
    expect(next.close).not.toHaveBeenCalled();
  });
  it("does not create frames for standalone effects", async () => {
    const custom = vi.fn(),
      fallback = vi.fn();
    expect(
      await context(custom, fallback).createRenderInputFrames({}, 1280, 720, 0),
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
    const first = { close: vi.fn() };
    const failure = new Error("bitmap allocation failed");
    const drawing = {
      ...Object.fromEntries(
        [
          "fillRect",
          "save",
          "restore",
          "beginPath",
          "moveTo",
          "lineTo",
          "stroke",
          "fill",
          "arcTo",
          "closePath",
        ].map((name) => [name, vi.fn()]),
      ),
      createLinearGradient: () => ({ addColorStop: vi.fn() }),
    };
    vi.stubGlobal(
      "OffscreenCanvas",
      class {
        getContext() {
          return drawing;
        }
      },
    );
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValueOnce(first).mockRejectedValueOnce(failure),
    );
    try {
      await expect(createInputFrames(128, 72, 0)).rejects.toBe(failure);
      expect(first.close).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
