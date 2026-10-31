import { readInspectorNumber } from "../src/apps/viewer/inspector/field-model.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  roundInspectorNumber,
  syncInspectorLayerPropertyState,
} from "../src/apps/viewer/inspector/number-fields";

class InputStub {
  dataset: { layerId: string; property: string };
  constructor(
    layerId: string,
    public value: string,
  ) {
    this.dataset = { layerId, property: "x" };
  }
}
class ButtonStub {
  classList = { toggle: vi.fn() };
  dataset = { layerId: "card", property: "x" };
  setAttribute = vi.fn();
  title = "";
}

describe("viewer inspector numeric field synchronization", () => {
  beforeEach(() => {
    vi.stubGlobal("HTMLInputElement", InputStub);
    vi.stubGlobal("HTMLButtonElement", ButtonStub);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("updates matching transform fields and key states during canvas drag", () => {
    const xInput = new InputStub("card", "0");
    const otherInput = new InputStub("other", "12");
    const keyButton = new ButtonStub();
    vi.stubGlobal("document", { activeElement: null });
    const ctx = {
      deps: { t: (_key: string, fallback: string) => fallback },
      hasLayerPropertyKeyframeAtCurrentTime: vi.fn(() => true),
      refs: {
        inspectorPanel: {
          querySelectorAll: vi
            .fn()
            .mockReturnValueOnce([xInput, otherInput])
            .mockReturnValueOnce([keyButton]),
        },
      },
      roundInspectorNumber: (value: unknown) =>
        Math.round(Number(value) * 1000) / 1000,
    } as any;

    syncInspectorLayerPropertyState(ctx, "card", { x: 24.4612 });

    expect(xInput.value).toBe("24.461");
    expect(otherInput.value).toBe("12");
    expect(keyButton.classList.toggle).toHaveBeenCalledWith("active", true);
    expect(keyButton.setAttribute).toHaveBeenCalledWith("aria-pressed", "true");
    expect(keyButton.title).toBe("Remove keyframe at current time");
  });

  it("does not overwrite a numeric field while the user is editing it", () => {
    const input = new InputStub("card", "draft");
    vi.stubGlobal("document", { activeElement: input });
    const ctx = {
      refs: {
        inspectorPanel: {
          querySelectorAll: vi
            .fn()
            .mockReturnValueOnce([input])
            .mockReturnValueOnce([]),
        },
      },
      roundInspectorNumber: vi.fn(),
    } as any;

    syncInspectorLayerPropertyState(ctx, "card", { x: 10 });

    expect(input.value).toBe("draft");
    expect(ctx.roundInspectorNumber).not.toHaveBeenCalled();
  });
});

describe("inspector number presentation", () => {
  it.each(
    [true, "12", [12], { toString: null }, Infinity].map((value: unknown) => ({
      value,
    })),
  )("does not coerce malformed values: %j", ({ value }) => {
    expect(roundInspectorNumber(value)).toBe(0);
  });
  it("preserves finite large values and rounds normal decimal values", () => {
    expect(roundInspectorNumber(1e308)).toBe(1e308);
    expect(roundInspectorNumber(12.12345)).toBe(12.123);
  });
});

describe("inspector numeric edit boundary", () => {
  it.each(
    [NaN, Infinity, "", "12", null, true, [], { toString: null }].map(
      (value: unknown) => ({ value }),
    ),
  )("rejects invalid native numeric values: %j", ({ value }) => {
    expect(readInspectorNumber(value, { min: -10, max: 10 })).toBeNull();
  });
  it("keeps zero and clamps valid numeric edits to the field range", () => {
    expect(readInspectorNumber(0, { min: -10, max: 10 })).toBe(0);
    expect(readInspectorNumber(-12, { min: -10, max: 10 })).toBe(-10);
    expect(readInspectorNumber(12, { min: -10, max: 10 })).toBe(10);
  });
});
