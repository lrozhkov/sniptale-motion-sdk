import { describe, expect, it } from "vitest";

import {
  getKeyframeDisplayLabel,
  getKeyframeEasingLabel,
} from "../src/apps/viewer/inspector/keyframe-labels";

describe("viewer keyframe labels", () => {
  const ctx: any = {
    deps: {
      t: (key: string, fallback: string) =>
        key.endsWith(".out") ? "Плавный выход" : fallback,
    },
    formatSeconds: (value: number) => `${value.toFixed(3)}с`,
    getTimelineTrackDisplayLabel: (track: any) => track.label,
    toTitleLabel: (value: string) => value,
  };

  it("uses the same localized easing label outside the dropdown", () => {
    expect(getKeyframeEasingLabel(ctx, "out")).toBe("Плавный выход");
    expect(getKeyframeEasingLabel(ctx, undefined)).toBe("linear");
  });

  it("describes a keyframe by track and time instead of a technical id", () => {
    expect(
      getKeyframeDisplayLabel(
        ctx,
        { id: "glow", keyframes: [], label: "Scene glow" },
        { id: "scene-glow-b", time: 1.5, value: 0.5 },
      ),
    ).toBe("Scene glow · 1.500с");
  });
});
