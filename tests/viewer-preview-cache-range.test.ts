import { describe, expect, it } from "vitest";

import { resolvePreviewCacheFrameRange } from "../src/apps/viewer/playback/cache-range";

describe("viewer preview cache frame range", () => {
  it("covers the complete clip when no playback interval is selected", () => {
    expect(
      resolvePreviewCacheFrameRange({ duration: 4, fps: 10, range: null }),
    ).toEqual({ endFrame: 41, fps: 10, startFrame: 0 });
  });

  it("uses only the selected playback interval", () => {
    expect(
      resolvePreviewCacheFrameRange({
        duration: 4,
        fps: 10,
        range: { end: 1.3, start: 1 },
      }),
    ).toEqual({ endFrame: 14, fps: 10, startFrame: 10 });
  });
});
