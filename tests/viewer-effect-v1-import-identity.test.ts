import { describe, expect, it } from "vitest";

import { remapImportedEffectIdentity } from "../src/apps/viewer/effect-file/import-identity.js";

describe("Effect v1 imported runtime identity", () => {
  it("keeps template, document and renderer effect ids canonical", () => {
    const remapped = remapImportedEffectIdentity(
      {
        effectId: "original",
        effectV1: { id: "original" },
        id: "original",
        moduleId: "original",
      },
      { id: "original", schemaVersion: "sniptale.effect.v1" },
      "original-import",
      "original-import-document",
    );

    expect(remapped).toEqual({
      document: {
        id: "original-import",
        schemaVersion: "sniptale.effect.v1",
      },
      template: {
        effectId: "original-import",
        effectV1: {
          id: "original-import",
          schemaVersion: "sniptale.effect.v1",
        },
        id: "original-import",
        moduleId: "original-import-document",
      },
    });
  });
});
