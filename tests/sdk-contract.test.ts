import { describe, expect, it } from "vitest";

import {
  ArtifactType,
  EFFECT_FILE_SCHEMA,
  ENGINE_VERSION,
  PROTOCOL_VERSION,
  type EffectArtifactType,
} from "../src/sdk";

describe("SDK public contract", () => {
  it("resets branded constants while preserving the engine ordinal", () => {
    expect(EFFECT_FILE_SCHEMA).toBe("sniptale.effect.v1");
    expect(ENGINE_VERSION).toBe("2.0-prototype");
    expect(PROTOCOL_VERSION).toBe("sniptale-effects-prototype-1");
  });

  it("exposes animation and transition artifact contract values", () => {
    const animationType: EffectArtifactType = "animation";
    const transitionType: EffectArtifactType = "transition";

    expect(ArtifactType).toMatchObject({
      ANIMATION: animationType,
      TRANSITION: transitionType,
    });
  });
});
