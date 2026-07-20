import { describe, expect, it, vi } from "vitest";

import { prepareCanvasGesture } from "../src/apps/viewer/canvas/gesture";

describe("viewer canvas gesture", () => {
  it("pauses playback before fixing one timeline time for the gesture", () => {
    const pausePlayback = vi.fn(() => undefined);
    const snapTime = vi.fn(() => 1.25);
    const ctx = {
      pausePlayback,
      refs: { timeSlider: { value: "1.234" } },
      snapTime,
      state: { playing: true },
    } as any;

    expect(prepareCanvasGesture(ctx)).toBe(1.25);
    expect(pausePlayback).toHaveBeenCalledWith({
      preservePreparation: true,
      renderCurrentFrame: false,
    });
    expect(snapTime).toHaveBeenCalledWith(1.234);
  });

  it("keeps an already paused canvas gesture at the current time", () => {
    const pausePlayback = vi.fn();
    const ctx = {
      pausePlayback,
      refs: { timeSlider: { value: "2" } },
      snapTime: (time) => time,
      state: { playing: false },
    } as any;

    expect(prepareCanvasGesture(ctx)).toBe(2);
    expect(pausePlayback).not.toHaveBeenCalled();
  });
});
