import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { prepareCanvasGesture } from "../src/apps/viewer/canvas/gesture";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("viewer canvas gesture", () => {
  it("pauses playback before fixing one timeline time for the gesture", () => {
    const ctx = createViewerContextFixture();
    const pausePlayback = vi.spyOn(ctx, "pausePlayback").mockReturnValue(true);
    const snapTime = vi.spyOn(ctx, "snapTime").mockReturnValue(1.25);
    ctx.refs.timeSlider.value = "1.234";
    ctx.state.playing = true;

    expect(prepareCanvasGesture(ctx)).toBe(1.25);
    expect(pausePlayback).toHaveBeenCalledWith({
      preservePreparation: true,
      renderCurrentFrame: false,
    });
    expect(snapTime).toHaveBeenCalledWith(1.234);
  });

  it("keeps an already paused canvas gesture at the current time", () => {
    const ctx = createViewerContextFixture();
    const pausePlayback = vi.spyOn(ctx, "pausePlayback").mockReturnValue(false);
    vi.spyOn(ctx, "snapTime").mockImplementation((time) => time);
    ctx.refs.timeSlider.value = "2";
    ctx.state.playing = false;

    expect(prepareCanvasGesture(ctx)).toBe(2);
    expect(pausePlayback).not.toHaveBeenCalled();
  });
});
