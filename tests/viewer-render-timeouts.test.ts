import { describe, expect, it } from "vitest";

import { DEFAULT_RENDER_TIMEOUT_MS } from "../src/sdk/protocol";
import {
  EDITOR_RENDER_TIMEOUT_MS,
  FULL_QUALITY_RENDER_TIMEOUT_MS,
  INTERACTIVE_RENDER_TIMEOUT_MS,
  PREVIEW_CACHE_RENDER_TIMEOUT_MS,
  resolveViewerRenderTimeoutMs,
} from "../src/apps/viewer/rendering/timeouts";

describe("viewer render timeouts", () => {
  it("does not treat an ordinary slow interactive frame as a dead runtime", () => {
    expect(resolveViewerRenderTimeoutMs()).toBe(INTERACTIVE_RENDER_TIMEOUT_MS);
    expect(INTERACTIVE_RENDER_TIMEOUT_MS).toBeGreaterThan(
      DEFAULT_RENDER_TIMEOUT_MS,
    );
    expect(resolveViewerRenderTimeoutMs(true)).toBe(
      FULL_QUALITY_RENDER_TIMEOUT_MS,
    );
    expect(FULL_QUALITY_RENDER_TIMEOUT_MS).toBeGreaterThan(
      INTERACTIVE_RENDER_TIMEOUT_MS,
    );
    expect(resolveViewerRenderTimeoutMs(false, false)).toBe(
      EDITOR_RENDER_TIMEOUT_MS,
    );
    expect(EDITOR_RENDER_TIMEOUT_MS).toBeGreaterThan(
      INTERACTIVE_RENDER_TIMEOUT_MS,
    );
    expect(FULL_QUALITY_RENDER_TIMEOUT_MS).toBeGreaterThan(
      EDITOR_RENDER_TIMEOUT_MS,
    );
    expect(resolveViewerRenderTimeoutMs(false, true, true)).toBe(
      PREVIEW_CACHE_RENDER_TIMEOUT_MS,
    );
    expect(PREVIEW_CACHE_RENDER_TIMEOUT_MS).toBeGreaterThan(
      FULL_QUALITY_RENDER_TIMEOUT_MS,
    );
    expect(resolveViewerRenderTimeoutMs(false, true, false, 3840 * 2160)).toBe(
      INTERACTIVE_RENDER_TIMEOUT_MS * 4,
    );
    expect(resolveViewerRenderTimeoutMs(false, false, false, 3840 * 2160)).toBe(
      EDITOR_RENDER_TIMEOUT_MS * 4,
    );
    expect(resolveViewerRenderTimeoutMs(true, true, false, 3840 * 2160)).toBe(
      PREVIEW_CACHE_RENDER_TIMEOUT_MS,
    );
    expect(resolveViewerRenderTimeoutMs(false, true, false, Number.NaN)).toBe(
      INTERACTIVE_RENDER_TIMEOUT_MS,
    );
  });
});
