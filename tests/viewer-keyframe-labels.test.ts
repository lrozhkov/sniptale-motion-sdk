import { afterEach, describe, expect, it, vi } from "vitest";
import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

import {
  getKeyframeDisplayLabel,
  getKeyframeEasingLabel,
} from "../src/apps/viewer/inspector/keyframe-labels";

describe("viewer keyframe labels", () => {
  function context() {
    const ctx = createViewerContextFixture();
    ctx.deps.t = (key, fallback) =>
      key.endsWith(".out") ? "Плавный выход" : (fallback ?? key);
    vi.spyOn(ctx, "formatSeconds").mockImplementation(
      (value) => `${(typeof value === "number" ? value : 0).toFixed(3)}с`,
    );
    vi.spyOn(ctx, "getTimelineTrackDisplayLabel").mockImplementation((track) =>
      typeof track?.label === "string" ? track.label : (track?.id ?? ""),
    );
    vi.spyOn(ctx, "toTitleLabel").mockImplementation((value) =>
      typeof value === "string" ? value : "",
    );
    return ctx;
  }

  it("uses the same localized easing label outside the dropdown", () => {
    const ctx = context();
    expect(getKeyframeEasingLabel(ctx, "out")).toBe("Плавный выход");
    expect(getKeyframeEasingLabel(ctx, undefined)).toBe("linear");
  });

  it("describes a keyframe by track and time instead of a technical id", () => {
    const ctx = context();
    expect(
      getKeyframeDisplayLabel(
        ctx,
        { id: "glow", keyframes: [], label: "Scene glow" },
        { id: "scene-glow-b", time: 1.5, value: 0.5 },
      ),
    ).toBe("Scene glow · 1.500с");
  });
});
