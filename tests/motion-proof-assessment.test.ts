import { describe, expect, it } from "vitest";
import {
  alternateControl,
  assessBindings,
  assessAssetTransfers,
  assessFrames,
  proofTimes,
  type ProofFrame,
} from "../src/apps/cli/proof/assessment";
import { createStarterDocument } from "../src/apps/cli/starter";

function frame(hash: string, time: number): ProofFrame {
  return {
    hash,
    time,
    occupied: 30,
    lit: 30,
    observation: {
      version: 1,
      templateId: "sample",
      generation: 1,
      sequence: 1,
      time,
      scale: 1,
      assetBitmapTransfers: 0,
      assetEnvelopeTransfers: 0,
      bindings: {
        controls: [],
        phases: [],
        tracks: [],
        inputFrames: [],
        layerGateReads: [],
        primitivePaintReads: [],
      },
    },
  };
}
describe("product proof assessment", () => {
  it("requires real bitmap transfers for visual assets, without demanding them for audio", () => {
    const document = createStarterDocument("sample", "standalone");
    document.assets = [{ id: "mark", kind: "svg", mimeType: "image/svg+xml" }];
    const observed = frame("a", 1.5);
    expect(assessAssetTransfers(document, [observed]).ok).toBe(false);
    observed.observation.assetBitmapTransfers = 1;
    observed.observation.assetEnvelopeTransfers = 1;
    expect(assessAssetTransfers(document, [observed]).ok).toBe(true);
    document.assets = [{ id: "audio", kind: "audio", mimeType: "audio/ogg" }];
    expect(assessAssetTransfers(document, []).ok).toBe(true);
  });
  it("accepts transparent exact boundaries when the midpoint is visible and moving", () => {
    const start = { ...frame("empty", 0), occupied: 0, lit: 0 };
    const end = { ...frame("empty", 3), occupied: 0, lit: 0 };
    expect(assessFrames([start, frame("moving", 1.5), end], 3)).toEqual({
      animated: true,
      midpointVisible: true,
    });
  });
  it("includes timeline boundaries and samples without silently dropping a short range", () => {
    const document = createStarterDocument("sample", "standalone");
    document.timeline.phases.push({
      id: "short",
      start: 0.123456,
      duration: 0.0002,
    });
    const times = proofTimes(document);
    expect(times).toContain(0.123456);
    expect(times).toContain(0.123556);
    expect(times[0]).toBe(0);
    expect(times.at(-1)).toBe(document.duration);
  });
  it("does not accept a frozen or invisible effect", () => {
    expect(assessFrames([frame("a", 0), frame("a", 1.5)], 3).animated).toBe(
      false,
    );
    expect(
      assessFrames([frame("a", 0), { ...frame("b", 1.5), lit: 0 }], 3)
        .midpointVisible,
    ).toBe(false);
  });
  it("requires actual runtime binding reads", () => {
    const document = createStarterDocument("sample", "standalone");
    expect(assessBindings(document, [frame("a", 0)]).controls).toEqual([
      "accent",
    ]);
    const observed = frame("a", 0);
    observed.observation.bindings.controls = ["accent"];
    expect(assessBindings(document, [observed]).controls).toEqual([]);
  });
  it("selects a valid alternate and rejects controls with no alternate", () => {
    expect(
      alternateControl({
        id: "size",
        kind: "number",
        defaultValue: 1,
        min: 0,
        max: 2,
      }),
    ).toBe(2);
    expect(
      alternateControl({
        id: "text",
        kind: "text",
        defaultValue: "A",
        options: [
          { value: "A", label: { en: "A" } },
          { value: "B", label: { en: "B" } },
        ],
      }),
    ).toBe("B");
    expect(() =>
      alternateControl({
        id: "fixed",
        kind: "number",
        defaultValue: 1,
        min: 1,
        max: 1,
      }),
    ).toThrow("PROOF_CONTROL_VARIANT");
  });
});
