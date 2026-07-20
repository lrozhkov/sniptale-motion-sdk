import { describe, expect, it } from "vitest";

import { templateUsesInputFrames } from "../src/apps/viewer/rendering/input-frames";

describe("viewer render input frames", () => {
  it("derives frame inputs only from the strict Effect v1 kind", () => {
    expect(templateUsesInputFrames({ effectV1: { kind: "transition" } })).toBe(
      true,
    );
    expect(
      templateUsesInputFrames({ effectV1: { kind: "targetEffect" } }),
    ).toBe(true);
    expect(templateUsesInputFrames({ effectV1: { kind: "standalone" } })).toBe(
      false,
    );
    expect(templateUsesInputFrames({ kind: "transitionEffect" })).toBe(false);
  });
});
