import { describe, expect, it } from "vitest";

import {
  createEffectV1ControlProofCases,
  didEffectV1ControlChange,
} from "../tooling/effect-v1/proof-controls.js";

describe("Effect v1 runtime control proof", () => {
  it("creates a valid non-default probe for every control kind", () => {
    expect(
      createEffectV1ControlProofCases([
        { defaultValue: "Title", id: "title", kind: "text" },
        { defaultValue: "#ff2d55", id: "accent", kind: "color" },
        {
          defaultValue: 4,
          id: "density",
          kind: "number",
          max: 8,
          min: 2,
          step: 2,
        },
      ]),
    ).toEqual([
      {
        defaultValue: "Title",
        id: "title",
        kind: "text",
        value: "Title · proof",
      },
      {
        defaultValue: "#ff2d55",
        id: "accent",
        kind: "color",
        value: "#00d4ff",
      },
      {
        defaultValue: 4,
        id: "density",
        kind: "number",
        value: 8,
      },
    ]);
  });

  it("fails closed when a numeric control has no distinct valid value", () => {
    expect(() =>
      createEffectV1ControlProofCases([
        {
          defaultValue: 1,
          id: "fixed",
          kind: "number",
          max: 1,
          min: 1,
        },
      ]),
    ).toThrow('Control "fixed" has no alternate value');
  });

  it("detects a visual change at any sampled time", () => {
    expect(
      didEffectV1ControlChange(
        [{ hash: "a" }, { hash: "b" }, { hash: "c" }],
        [{ hash: "a" }, { hash: "changed" }, { hash: "c" }],
      ),
    ).toBe(true);
    expect(
      didEffectV1ControlChange(
        [{ hash: "a" }, { hash: "b" }],
        [{ hash: "a" }, { hash: "b" }],
      ),
    ).toBe(false);
  });
});
