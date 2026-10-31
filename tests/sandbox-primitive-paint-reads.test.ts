import { describe, expect, it, vi } from "vitest";

import { createBindingReads } from "../src/apps/sandbox/runtime/binding-reads";
import { recordPrimitivePaintRead } from "../src/apps/sandbox/runtime/primitive-paint-reads";

describe("sandbox primitive paint reads", () => {
  it("rejects unknown identities and coordinates without conversion hooks", () => {
    const convert = vi.fn(() => 10);
    const value = { toString: convert, valueOf: convert };
    const reads = createBindingReads();
    const context = createPaintContext(reads, { width: 10 });
    recordPrimitivePaintRead(context, {
      layerId: value,
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
    expect(reads.primitivePaintReads.size).toBe(0);
    recordPrimitivePaintRead(context, {
      layerId: "box",
      x: value,
      y: 0,
      width: 10,
      height: 10,
    });
    expect(reads.primitiveBounds.size).toBe(0);
    expect(convert).not.toHaveBeenCalled();
  });

  it("does not construct bounds from coordinates of different invalid points", () => {
    const reads = createBindingReads();
    recordPrimitivePaintRead(createPaintContext(reads, { width: 10 }), {
      layerId: "path",
      points: [
        { x: 0, y: NaN },
        { x: NaN, y: 20 },
      ],
    });
    expect(reads.primitiveBounds.size).toBe(0);
  });

  it("restores the canvas font when text measurement fails", () => {
    const context = {
      __sniptaleBindingReads: createBindingReads(),
      font: "10px sans-serif",
      measureText() {
        throw new Error("measurement failed");
      },
    };
    expect(() =>
      recordPrimitivePaintRead(context, {
        layerId: "text",
        text: "Title",
        font: "40px Inter",
        x: 0,
        y: 0,
      }),
    ).toThrow("measurement failed");
    expect(context.font).toBe("10px sans-serif");
  });
  it("records measured text bounds for layer primitives", () => {
    const reads = createBindingReads();
    const context = createPaintContext(reads, {
      actualBoundingBoxAscent: 30,
      actualBoundingBoxDescent: 10,
      width: 200,
    });

    recordPrimitivePaintRead(context, {
      align: "center",
      baseline: "middle",
      font: "800 40px Inter",
      layerId: "title",
      maxWidth: 400,
      text: "Title",
      x: 640,
      y: 460,
    });

    expect(reads.primitivePaintReads.has("title")).toBe(true);
    expect(reads.primitiveBounds.get("title")).toEqual({
      height: 40,
      layerId: "title",
      width: 200,
      x: 540,
      y: 440,
    });
  });

  it("applies the current canvas transform and unions same-layer bounds", () => {
    const reads = createBindingReads();
    const context = createPaintContext(
      reads,
      { width: 100 },
      {
        a: 1,
        b: 0,
        c: 0,
        d: 1,
        e: 20,
        f: 30,
      },
    );

    recordPrimitivePaintRead(context, {
      height: 20,
      layerId: "box",
      width: 30,
      x: 10,
      y: 5,
    });
    recordPrimitivePaintRead(context, {
      height: 10,
      layerId: "box",
      width: 10,
      x: 80,
      y: 50,
    });

    expect(reads.primitiveBounds.get("box")).toEqual({
      height: 55,
      layerId: "box",
      width: 80,
      x: 30,
      y: 35,
    });
  });

  it("removes backing-raster scale while preserving local transforms", () => {
    const reads = createBindingReads();
    const context = {
      ...createPaintContext(
        reads,
        { width: 100 },
        {
          a: 1,
          b: 0,
          c: 0,
          d: 1.5,
          e: 20,
          f: 15,
        },
      ),
      __sniptaleLogicalScaleX: 0.5,
      __sniptaleLogicalScaleY: 0.5,
    };

    recordPrimitivePaintRead(context, {
      height: 20,
      layerId: "box",
      width: 30,
      x: 10,
      y: 5,
    });

    expect(reads.primitiveBounds.get("box")).toEqual({
      height: 60,
      layerId: "box",
      width: 60,
      x: 60,
      y: 45,
    });
  });

  it("measures only the selected layer in playback scope", () => {
    const reads = createBindingReads({
      dependencies: false,
      primitiveLayerId: "selected",
    });
    const context = createPaintContext(reads, { width: 100 });

    recordPrimitivePaintRead(context, {
      height: 20,
      layerId: "other",
      width: 30,
      x: 10,
      y: 5,
    });
    recordPrimitivePaintRead(context, {
      height: 20,
      layerId: "selected",
      width: 30,
      x: 10,
      y: 5,
    });

    expect(reads.primitivePaintReads).toEqual(new Set(["selected"]));
    expect(Array.from(reads.primitiveBounds)).toEqual([
      [
        "selected",
        {
          height: 20,
          layerId: "selected",
          width: 30,
          x: 10,
          y: 5,
        },
      ],
    ]);
  });
});

function createPaintContext(
  reads: ReturnType<typeof createBindingReads>,
  metrics: Partial<TextMetrics> & { width: number },
  transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
) {
  return {
    __sniptaleBindingReads: reads,
    font: "10px sans-serif",
    getTransform: () => transform,
    measureText: () => metrics,
  };
}
