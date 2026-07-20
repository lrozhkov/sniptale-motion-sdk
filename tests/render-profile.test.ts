import { describe, expect, it } from "vitest";

import {
  SANDBOX_RENDER_PROFILE_FIELDS,
  parseSandboxRenderProfile,
} from "../src/sdk/render-profile";

describe("sandbox render profile boundary", () => {
  it("accepts a complete finite phase profile", () => {
    const profile = Object.fromEntries(
      SANDBOX_RENDER_PROFILE_FIELDS.map((field, index) => [field, index]),
    );

    expect(parseSandboxRenderProfile(profile)).toEqual(profile);
  });

  it("rejects incomplete, negative, and non-finite timings", () => {
    const complete = Object.fromEntries(
      SANDBOX_RENDER_PROFILE_FIELDS.map((field) => [field, 0]),
    );

    expect(
      parseSandboxRenderProfile({ ...complete, rendererMs: -1 }),
    ).toBeNull();
    expect(
      parseSandboxRenderProfile({ ...complete, totalMs: Number.NaN }),
    ).toBeNull();
    const { queueMs: _queueMs, ...incomplete } = complete;
    expect(parseSandboxRenderProfile(incomplete)).toBeNull();
  });
});
