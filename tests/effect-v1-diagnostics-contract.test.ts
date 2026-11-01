import { describe, expect, it } from "vitest";

import { validateEffectV1Document } from "../src/sdk/effect-v1/index.js";
import {
  createInvalidEffectV1Cases,
  createNeutralEffectV1Document,
} from "../tooling/test/fixtures/effect-v1-documents.js";

const VALID_KINDS = ["standalone", "targetEffect", "transition"] as const;

describe("Effect v1 diagnostic contract", () => {
  it.each(VALID_KINDS)("keeps generated %s semantics valid", (kind) => {
    const document = createNeutralEffectV1Document(kind);
    expect(validateEffectV1Document(document)).toMatchObject({
      ok: true,
      summary: { errors: 0, warnings: 0 },
    });
  });

  it("keeps invalid diagnostics ordered and exact", () => {
    for (const testCase of createInvalidEffectV1Cases()) {
      const actual = validateEffectV1Document(
        testCase.document,
      ).diagnostics.map(({ code, path }) => ({ code, path }));
      expect({ id: testCase.id, diagnostics: actual }).toEqual({
        id: testCase.id,
        diagnostics: testCase.expected,
      });
    }
  });
});
