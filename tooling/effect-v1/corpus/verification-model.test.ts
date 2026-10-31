import { describe, expect, it } from "vitest";
import { parseRecordedExpectation } from "./verification-model.js";

const valid = () => ({
  accepted: true,
  artifact: "valid/effect.sniptale-bundle.zip",
  archiveBytes: 100,
  archiveSha256: "a".repeat(64),
  effectKinds: ["standalone"],
});

describe("corpus recorded expectation boundary", () => {
  it("owns effect kind values and preserves negative diagnostic expectations", () => {
    const raw = valid();
    const parsed = parseRecordedExpectation(raw);
    raw.effectKinds.push("transition");
    expect(parsed.effectKinds).toEqual(["standalone"]);
    expect(
      parseRecordedExpectation({
        ...valid(),
        accepted: false,
        primaryCode: "BUNDLE_ENTRY_MISSING",
      }).primaryCode,
    ).toBe("BUNDLE_ENTRY_MISSING");
  });

  it.each(
    [
      null,
      [],
      {},
      { ...valid(), accepted: "true" },
      { ...valid(), artifact: 1 },
      { ...valid(), archiveBytes: 0 },
      { ...valid(), archiveBytes: 1.5 },
      { ...valid(), archiveBytes: Infinity },
      { ...valid(), archiveSha256: "wrong" },
      { ...valid(), effectKinds: "standalone" },
      { ...valid(), effectKinds: [1] },
      { ...valid(), primaryCode: undefined },
      { ...valid(), primaryCode: 1 },
    ].map((value) => ({ value })),
  )("rejects malformed metadata without coercion: $value", ({ value }) => {
    expect(() => parseRecordedExpectation(value)).toThrow(/Corpus/u);
  });
});
