import { describe, expect, it } from "vitest";

import {
  assessEffectV1FrameProof,
  createEffectV1ProofTimes,
} from "../tooling/effect-v1/proof-frames.js";

describe("Effect v1 frame proof", () => {
  it("samples exact boundaries and visible enter/middle/exit frames", () => {
    expect(createEffectV1ProofTimes(4)).toEqual([0, 0.35, 2, 3.65, 4]);
    expect(createEffectV1ProofTimes(1)).toEqual([0, 0.18, 0.5, 0.82, 1]);
  });

  it("allows transparent exact boundaries for overlay animations", () => {
    expect(
      assessEffectV1FrameProof([
        { hash: "empty", lit: 0, occupied: 0 },
        { hash: "enter", lit: 30, occupied: 30 },
        { hash: "hold", lit: 80, occupied: 80 },
        { hash: "exit", lit: 30, occupied: 30 },
        { hash: "empty", lit: 0, occupied: 0 },
      ]),
    ).toMatchObject({ animated: true, midpointVisible: true, ok: true });
  });

  it("rejects an empty midpoint or a static frame sequence", () => {
    expect(
      assessEffectV1FrameProof([
        { hash: "a", lit: 30, occupied: 30 },
        { hash: "a", lit: 30, occupied: 30 },
        { hash: "a", lit: 30, occupied: 30 },
      ]).ok,
    ).toBe(false);
    expect(
      assessEffectV1FrameProof([
        { hash: "a", lit: 30, occupied: 30 },
        { hash: "b", lit: 0, occupied: 0 },
        { hash: "c", lit: 30, occupied: 30 },
      ]).ok,
    ).toBe(false);
  });
});
