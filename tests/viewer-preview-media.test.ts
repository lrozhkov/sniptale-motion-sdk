import { describe, expect, it } from "vitest";

import {
  parsePreviewMediaSlot,
  resolvePreviewMediaSlots,
} from "../src/apps/viewer/preview-media/model.js";

describe("type-aware preview media", () => {
  it.each(["source", "from", "to"])("accepts the declared slot %s", (slot) => {
    expect(parsePreviewMediaSlot(slot)).toBe(slot);
  });
  it.each([undefined, null, "", "SOURCE", "other", {}, ["source"]])(
    "rejects an unparsed slot: %j",
    (value) => {
      expect(parsePreviewMediaSlot(value)).toBeNull();
    },
  );
  it.each([
    undefined,
    null,
    [],
    { effectV1: null },
    { effectV1: 42 },
    { effectV1: { kind: {} } },
  ])("does not infer media inputs from malformed metadata: %j", (value) => {
    expect(resolvePreviewMediaSlots(value)).toEqual([]);
  });
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
