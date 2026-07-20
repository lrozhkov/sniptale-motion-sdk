import { describe, expect, it } from "vitest";

import {
  SANDBOX_RENDER_PROFILE_FIELDS,
  type SandboxRenderProfile,
} from "../src/sdk/render-profile";
import {
  isDirectLiveRenderPreferred,
  recordDirectLiveRenderProfile,
  shouldProfileDirectLiveRender,
} from "../src/apps/viewer/rendering/direct-live-policy";

function createContext() {
  return {
    state: {
      directLiveProfileCompleteKeys: new Set(),
      directLiveProfileSamples: new Map(),
      directLiveRenderKeys: new Set(),
      directRenderEffectIds: new Set(["heavy"]),
      directRenderResponsePort: { presentationSurfaceAttached: true },
      playing: true,
      previewCacheEnabled: false,
      previewRasterHeight: 720,
      previewRasterWidth: 1280,
    },
  } as any;
}

function createProfile(
  patch: Partial<SandboxRenderProfile>,
): SandboxRenderProfile {
  return {
    ...Object.fromEntries(
      SANDBOX_RENDER_PROFILE_FIELDS.map((field) => [field, 0]),
    ),
    totalMs: 100,
    ...patch,
  } as SandboxRenderProfile;
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
