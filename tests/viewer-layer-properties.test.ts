import { describe, expect, it } from "vitest";

import { getTrackLayerId } from "../src/apps/viewer/layers/properties";

describe("viewer layer property ownership", () => {
  it("does not infer a fake layer from an explicit scene target", () => {
    expect(getTrackLayerId({ id: "scene.glow", target: "scene" })).toBe(null);
    expect(getTrackLayerId({ id: "card.glow", target: "card" })).toBe("card");
    expect(getTrackLayerId({ id: "legacy.opacity" })).toBe("legacy");
  });
});
