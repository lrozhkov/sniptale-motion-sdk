import { describe, expect, it, vi } from "vitest";
import { diagnosticValue } from "../src/sdk/diagnostic-value.js";
import {
  decodeEffectV1EmbeddedAsset,
  assertEffectV1AssetSignature,
} from "../src/sdk/effect-v1/asset-integrity.js";

describe("diagnostic values at unknown boundaries", () => {
  it("does not invoke object hooks in diagnostics or data URLs", () => {
    const convert = vi.fn<() => string>(() => "data:image/png;base64,AQ==");
    const value = {
      toString: convert,
      valueOf: convert,
      [Symbol.toPrimitive]: convert,
    };
    expect(diagnosticValue(value)).toBe("(invalid)");
    expect(() => decodeEffectV1EmbeddedAsset({ dataUrl: value })).toThrow(
      "base64 data URL",
    );
    expect(() =>
      assertEffectV1AssetSignature(new Uint8Array([0]), value, value),
    ).toThrow('Asset "(invalid)" content does not match (invalid).');
    expect(convert).not.toHaveBeenCalled();
  });
  it("keeps primitive diagnostic identifiers readable", () => {
    expect(diagnosticValue("asset-1")).toBe("asset-1");
    expect(diagnosticValue(12)).toBe("12");
    expect(diagnosticValue(null)).toBe("null");
    expect(diagnosticValue(undefined)).toBe("undefined");
  });
});
