import { afterEach, describe, expect, it, vi } from "vitest";

import { syncInspectorLayerPropertyState } from "../src/apps/viewer/inspector/number-fields";

describe("viewer inspector numeric field synchronization", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("updates matching transform fields and key states during canvas drag", () => {
    const xInput = {
      dataset: { layerId: "card", property: "x" },
      value: "0",
    };
    const otherInput = {
      dataset: { layerId: "other", property: "x" },
      value: "12",
    };
    const keyButton = {
      classList: { toggle: vi.fn() },
      dataset: { layerId: "card", property: "x" },
      setAttribute: vi.fn(),
      title: "",
    };
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
      roundInspectorNumber: (value) => Math.round(Number(value) * 1000) / 1000,
    } as any;

    syncInspectorLayerPropertyState(ctx, "card", { x: 24.4612 });

    expect(xInput.value).toBe("24.461");
    expect(otherInput.value).toBe("12");
    expect(keyButton.classList.toggle).toHaveBeenCalledWith("active", true);
    expect(keyButton.setAttribute).toHaveBeenCalledWith("aria-pressed", "true");
    expect(keyButton.title).toBe("Remove keyframe at current time");
  });

  it("does not overwrite a numeric field while the user is editing it", () => {
    const input = {
      dataset: { layerId: "card", property: "x" },
      value: "draft",
    };
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
