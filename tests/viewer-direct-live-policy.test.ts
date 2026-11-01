import { afterEach, describe, expect, it, vi } from "vitest";
import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

import {
  SANDBOX_RENDER_PROFILE_FIELDS,
  parseSandboxRenderProfile,
  type SandboxRenderProfile,
} from "../src/sdk/render-profile";
import {
  isDirectLiveRenderPreferred,
  recordDirectLiveRenderProfile,
  shouldProfileDirectLiveRender,
} from "../src/apps/viewer/rendering/direct-live-policy";

function createContext() {
  const ctx = createViewerContextFixture();
  ctx.state.directRenderEffectIds.add("heavy");
  ctx.state.directRenderResponsePort = {
    presentationSurfaceAttached: true,
    close() {},
    postMessage(_message: unknown, _transfer?: Transferable[]) {},
  };
  ctx.state.playing = true;
  ctx.state.previewCacheEnabled = false;
  ctx.state.previewRasterHeight = 720;
  ctx.state.previewRasterWidth = 1280;
  return ctx;
}

function createProfile(
  patch: Partial<SandboxRenderProfile>,
): SandboxRenderProfile {
  const profile = parseSandboxRenderProfile({
    ...Object.fromEntries(
      SANDBOX_RENDER_PROFILE_FIELDS.map((field) => [field, 0]),
    ),
    totalMs: 100,
    ...patch,
  });
  if (!profile) throw new Error("Invalid render profile fixture.");
  return profile;
}

describe("viewer adaptive direct Live rendering", () => {
  it("switches to a direct surface when bitmap normalization dominates", () => {
    const ctx = createContext();
    const template = { effectId: "heavy" };

    expect(shouldProfileDirectLiveRender(ctx, template)).toBe(true);
    recordDirectLiveRenderProfile(
      ctx,
      template,
      createProfile({ normalizeMs: 70 }),
    );

    expect(isDirectLiveRenderPreferred(ctx, template)).toBe(true);
    expect(shouldProfileDirectLiveRender(ctx, template)).toBe(false);
  });

  it("stops profiling a raster when normalization stays inexpensive", () => {
    const ctx = createContext();
    const template = { effectId: "heavy" };

    for (let sample = 0; sample < 24; sample += 1) {
      recordDirectLiveRenderProfile(
        ctx,
        template,
        createProfile({ normalizeMs: 10 }),
      );
    }

    expect(isDirectLiveRenderPreferred(ctx, template)).toBe(false);
    expect(shouldProfileDirectLiveRender(ctx, template)).toBe(false);
  });
});
