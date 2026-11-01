import { describe, expect, it, vi } from "vitest";

import { createFrameCanvasPool } from "../src/apps/sandbox/runtime/frame-canvas-pool";

describe("sandbox frame canvas pool", () => {
  it("reuses the same effect's frame-scoped canvas slots and resets them", () => {
    const createCanvas = vi.fn<typeof createTestCanvas>((width, height) =>
      createTestCanvas(width, height),
    );
    const pool = createFrameCanvasPool(createCanvas);
    const firstFrame = pool.beginFrame("effect-a");
    const firstOutput = firstFrame.createCanvas(1280, 720);
    const firstIntermediate = firstFrame.createCanvas(1280, 720);
    firstFrame.release();

    const secondFrame = pool.beginFrame("effect-a");
    expect(secondFrame.createCanvas(1280, 720)).toBe(firstOutput);
    expect(secondFrame.createCanvas(1280, 720)).toBe(firstIntermediate);
    secondFrame.release();

    expect(createCanvas).toHaveBeenCalledTimes(2);
    expect(firstOutput.contextResetCount).toBe(1);
    expect(firstIntermediate.contextResetCount).toBe(1);
    expect(firstOutput.backingStoreResetCount).toBe(0);
    expect(firstIntermediate.backingStoreResetCount).toBe(0);
    expect(pool.size()).toBe(2);
  });

  it("falls back to a backing-store reset when context.reset is unavailable", () => {
    const pool = createFrameCanvasPool((width, height) =>
      createTestCanvas(width, height, false),
    );
    const firstFrame = pool.beginFrame("legacy-effect");
    const canvas = firstFrame.createCanvas(320, 180);
    firstFrame.release();

    const secondFrame = pool.beginFrame("legacy-effect");
    expect(secondFrame.createCanvas(320, 180)).toBe(canvas);
    secondFrame.release();

    expect(canvas.backingStoreResetCount).toBe(1);
  });

  it("does not share a canvas between effects or overlapping frames", () => {
    const createCanvas = vi.fn<typeof createTestCanvas>((width, height) =>
      createTestCanvas(width, height),
    );
    const pool = createFrameCanvasPool(createCanvas);
    const firstFrame = pool.beginFrame("effect-a");
    const first = firstFrame.createCanvas(320, 180);
    const overlappingFrame = pool.beginFrame("effect-a");
    const overlapping = overlappingFrame.createCanvas(320, 180);
    const otherEffectFrame = pool.beginFrame("effect-b");
    const otherEffect = otherEffectFrame.createCanvas(320, 180);

    expect(overlapping).not.toBe(first);
    expect(otherEffect).not.toBe(first);
    expect(otherEffect).not.toBe(overlapping);

    firstFrame.release();
    overlappingFrame.release();
    otherEffectFrame.release();
  });
});

function createTestCanvas(
  initialWidth: number,
  initialHeight: number,
  supportsContextReset = true,
) {
  let width = initialWidth;
  let height = initialHeight;
  let contextResetCount = 0;
  return {
    backingStoreResetCount: 0,
    get contextResetCount() {
      return contextResetCount;
    },
    getContext() {
      return supportsContextReset
        ? {
            reset() {
              contextResetCount += 1;
            },
          }
        : {};
    },
    get height() {
      return height;
    },
    set height(value) {
      height = value;
      this.backingStoreResetCount += 1;
    },
    get width() {
      return width;
    },
    set width(value) {
      width = value;
      this.backingStoreResetCount += 1;
    },
  };
}
