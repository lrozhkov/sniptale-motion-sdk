import { describe, expect, it } from "vitest";

import { resolvePreviewMediaSlots } from "../src/apps/viewer/preview-media/model.js";

describe("type-aware preview media", () => {
  it("derives only the inputs declared by the Effect v1 kind", () => {
    expect(
      resolvePreviewMediaSlots({ effectV1: { kind: "standalone" } }),
    ).toEqual([]);
    expect(
      resolvePreviewMediaSlots({ effectV1: { kind: "targetEffect" } }),
    ).toEqual(["source"]);
    expect(
      resolvePreviewMediaSlots({ effectV1: { kind: "transition" } }),
    ).toEqual(["from", "to"]);
  });
});
