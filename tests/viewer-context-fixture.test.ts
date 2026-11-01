import { afterEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("viewer context fixture boundary", () => {
  it("uses independent real state, dependencies and bound actions for each context", () => {
    const first = createViewerContextFixture();
    const second = createViewerContextFixture();
    first.state.currentTemplate = { id: "first", duration: 4 };
    second.state.currentTemplate = { id: "second", duration: 8 };
    first.setEditorOverride({ duration: 2 });
    first.deps.t = () => "first";
    expect(first.getEffectiveDuration()).toBe(2);
    expect(second.getEffectiveDuration()).toBe(8);
    expect(second.state.editorOverrides.size).toBe(0);
    expect(first.deps).not.toBe(second.deps);
    expect(second.deps.t("missing", "second")).toBe("second");
  });
});
