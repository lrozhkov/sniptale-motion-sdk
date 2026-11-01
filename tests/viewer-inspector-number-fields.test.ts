import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
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
  classList = {
    toggle: vi.fn<DOMTokenList["toggle"]>().mockReturnValue(false),
  };
  dataset = { layerId: "card", property: "x" };
  setAttribute = vi.fn<HTMLButtonElement["setAttribute"]>();
  title = "";
}

describe("viewer inspector numeric field synchronization", () => {
  beforeEach(() => {
    vi.stubGlobal("HTMLInputElement", InputStub);
    vi.stubGlobal("HTMLButtonElement", ButtonStub);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("updates matching transform fields and key states during canvas drag", () => {
    const ctx = createViewerContextFixture();
    const xInput = createInput("card", "0");
    const otherInput = createInput("other", "12");
    const keyButton = new HTMLButtonElement();
    const toggle = vi.spyOn(keyButton.classList, "toggle");
    const setAttribute = vi.spyOn(keyButton, "setAttribute");
    vi.stubGlobal("document", { activeElement: null });
    ctx.deps.t = (key, fallback) => fallback ?? key;
    vi.spyOn(ctx, "hasLayerPropertyKeyframeAtCurrentTime").mockReturnValue(
      true,
    );
    const query = vi
      .fn<(selector: string) => (HTMLInputElement | HTMLButtonElement)[]>()
      .mockReturnValueOnce([xInput, otherInput])
      .mockReturnValueOnce([keyButton]);
    Object.assign(ctx.refs.inspectorPanel, { querySelectorAll: query });

    syncInspectorLayerPropertyState(ctx, "card", { x: 24.4612 });

    expect(xInput.value).toBe("24.461");
    expect(otherInput.value).toBe("12");
    expect(toggle).toHaveBeenCalledWith("active", true);
    expect(setAttribute).toHaveBeenCalledWith("aria-pressed", "true");
    expect(keyButton.title).toBe("Remove keyframe at current time");
  });

  it("does not overwrite a numeric field while the user is editing it", () => {
    const ctx = createViewerContextFixture();
    const input = createInput("card", "draft");
    vi.stubGlobal("document", { activeElement: input });
    const query = vi
      .fn<(selector: string) => HTMLInputElement[]>()
      .mockReturnValueOnce([input])
      .mockReturnValueOnce([]);
    Object.assign(ctx.refs.inspectorPanel, { querySelectorAll: query });
    const round = vi.spyOn(ctx, "roundInspectorNumber");

    syncInspectorLayerPropertyState(ctx, "card", { x: 10 });

    expect(input.value).toBe("draft");
    expect(round).not.toHaveBeenCalled();
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

function createInput(layerId: string, value: string) {
  return Object.assign(new HTMLInputElement(), {
    dataset: { layerId, property: "x" },
    value,
  });
}
