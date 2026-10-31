import { describe, expect, it } from "vitest";
import {
  createGraphPointerMapper,
  type GraphPointerSurface,
} from "../src/apps/viewer/graph-editor/pointer-coordinates.js";

const event = { clientX: 260, clientY: 80 };
const surface: GraphPointerSurface = {
  getBoundingClientRect: () => ({ left: 10, top: 20, width: 500, height: 120 }),
  viewBox: { baseVal: { width: 1000, height: 240 } },
};

describe("graph SVG pointer coordinates", () => {
  it("maps a scaled viewport when no screen matrix is available", () => {
    expect(createGraphPointerMapper(surface)(event)).toEqual({
      x: 500,
      y: 120,
    });
  });
  it("uses a finite screen inverse", () => {
    const map = createGraphPointerMapper({
      ...surface,
      getScreenCTM: () => ({
        inverse: () => ({ a: 2, b: 0, c: 0, d: 2, e: -20, f: -40 }),
      }),
    });
    expect(map(event)).toEqual({ x: 500, y: 120 });
  });
  it.each([Number.NaN, Number.POSITIVE_INFINITY])(
    "falls back from a non-finite matrix component %s",
    (invalid) => {
      const map = createGraphPointerMapper({
        ...surface,
        getScreenCTM: () => ({
          inverse: () => ({ a: invalid, b: 0, c: 0, d: 2, e: -20, f: -40 }),
        }),
      });
      expect(map(event)).toEqual({ x: 500, y: 120 });
    },
  );
  it("falls back when matrix inversion throws", () => {
    const map = createGraphPointerMapper({
      ...surface,
      getScreenCTM: () => ({
        inverse: () => {
          throw new Error("singular");
        },
      }),
    });
    expect(map(event)).toEqual({ x: 500, y: 120 });
  });
  it("rejects non-finite geometry and pointer inputs", () => {
    const map = createGraphPointerMapper({
      ...surface,
      getBoundingClientRect: () => ({
        left: Number.NaN,
        top: 0,
        width: 0,
        height: 0,
      }),
    });
    expect(map(event)).toBeNull();
    expect(
      createGraphPointerMapper(surface)({ clientX: Number.NaN, clientY: 0 }),
    ).toBeNull();
  });
});
