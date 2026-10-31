import { vi } from "vitest";
import type { RuntimeCanvas } from "../../src/apps/sandbox/runtime/canvas-model.js";

/** Stub the browser constructor at the test boundary without widening product types. */
export function createRuntimeCanvasFixture(
  context: object | null,
  width: number,
  height: number,
  logical: Pick<
    RuntimeCanvas,
    "__sniptaleLogicalHeight" | "__sniptaleLogicalWidth"
  > = {},
): RuntimeCanvas {
  const previous = globalThis.OffscreenCanvas;
  const wasOwn = Object.hasOwn(globalThis, "OffscreenCanvas");
  class FixtureCanvas {
    constructor(
      public width: number,
      public height: number,
    ) {}
    getContext() {
      return context;
    }
  }
  vi.stubGlobal("OffscreenCanvas", FixtureCanvas);
  try {
    return Object.assign(new OffscreenCanvas(width, height), logical);
  } finally {
    if (wasOwn) vi.stubGlobal("OffscreenCanvas", previous);
    else Reflect.deleteProperty(globalThis, "OffscreenCanvas");
  }
}
