import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { syncInspectorLayerPropertyState } from "../src/apps/viewer/inspector/number-fields";

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
