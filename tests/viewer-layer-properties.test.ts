import { describe, expect, it } from "vitest";

import { installLayersPropertiesOwner } from "../src/apps/viewer/layers/properties";

describe("viewer layer property ownership", () => {
  it("does not infer a fake layer from an explicit scene target", () => {
    const ctx: any = {};
    installLayersPropertiesOwner(ctx);

    expect(ctx.getTrackLayerId({ id: "scene.glow", target: "scene" })).toBe(
      null,
    );
    expect(ctx.getTrackLayerId({ id: "card.glow", target: "card" })).toBe(
      "card",
    );
    expect(ctx.getTrackLayerId({ id: "legacy.opacity" })).toBe("legacy");
  });
});
