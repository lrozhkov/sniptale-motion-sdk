import { describe, expect, it } from "vitest";

import { createEffectV1RuntimeContractProof } from "../tooling/effect-v1/proof-contract.js";

describe("Effect v1 runtime contract proof", () => {
  it("reports missing runtime reads by binding kind", () => {
    const proof = createEffectV1RuntimeContractProof(
      {
        controls: [{ id: "accent" }, { id: "title" }],
        timeline: {
          phases: [{ id: "enter" }, { id: "exit" }],
          tracks: [{ id: "opacity" }],
        },
      },
      {
        controls: ["accent"],
        phases: ["enter"],
        tracks: ["opacity"],
      },
      [],
    );

    expect(proof).toMatchObject({
      missing: { controls: ["title"], phases: ["exit"], tracks: [] },
      ok: false,
    });
  });

  it("keeps viewer contract diagnostics authoritative", () => {
    const proof = createEffectV1RuntimeContractProof(
      { controls: [], timeline: { phases: [], tracks: [] } },
      {},
      [
        { category: "Structure", message: "Unrelated editor issue" },
        { category: "Contract", message: "Layer is not gated" },
      ],
    );

    expect(proof.contractIssues).toEqual(["Layer is not gated"]);
    expect(proof.ok).toBe(false);
  });
});
