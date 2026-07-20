import { describe, expect, it } from "vitest";

import { shouldCapturePlaybackBindingReads } from "../src/apps/viewer/rendering/binding-read-cadence";

describe("viewer playback binding reads", () => {
  it("samples selected-layer geometry at a bounded cadence", () => {
    const state = {
      lastPlaybackBindingReadAtMs: 0,
      playbackBindingLayerId: null,
    };

    expect(shouldCapturePlaybackBindingReads(state, "logo", 100)).toBe(true);
    expect(shouldCapturePlaybackBindingReads(state, "logo", 150)).toBe(false);
    expect(shouldCapturePlaybackBindingReads(state, "logo", 184)).toBe(true);
  });

  it("captures immediately when selection changes and clears empty scope", () => {
    const state = {
      lastPlaybackBindingReadAtMs: 100,
      playbackBindingLayerId: "logo",
    };

    expect(shouldCapturePlaybackBindingReads(state, "tagline", 120)).toBe(true);
    expect(shouldCapturePlaybackBindingReads(state, null, 140)).toBe(false);
    expect(state).toEqual({
      lastPlaybackBindingReadAtMs: 0,
      playbackBindingLayerId: null,
    });
  });
});
