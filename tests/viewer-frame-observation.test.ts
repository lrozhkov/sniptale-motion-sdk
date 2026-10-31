import { describe, expect, it, vi } from "vitest";
import {
  parseFrameObservation,
  type FrameObservation,
} from "../src/shared/proof/frame-observation";
import {
  discardStaleFrame,
  isCurrentFrame,
} from "../src/apps/viewer/rendering/frame-observation";

function observation(): FrameObservation {
  return {
    version: 1,
    templateId: "sample",
    sequence: 2,
    generation: 1,
    time: 0.5,
    scale: 1,
    assetBitmapTransfers: 0,
    assetEnvelopeTransfers: 0,
    bindings: {
      controls: ["accent"],
      phases: [],
      tracks: [],
      inputFrames: [],
      layerGateReads: [],
      primitivePaintReads: [],
    },
  };
}
describe("presented frame identity", () => {
  it("rechecks authority and closes a bitmap when the template changes after an earlier check", () => {
    const template = { id: "same" };
    const state = {
      currentTemplate: template,
      frameSequence: 2,
      sandboxRuntimeGeneration: 1,
      staleResponses: 0,
    };
    const token = { template, sequence: 2, generation: 1 };
    const close = vi.fn();
    const response = { sequenceId: 2, bitmap: { close } };
    expect(discardStaleFrame({ state }, token, response)).toBe(false);
    state.currentTemplate = { id: "same" };
    expect(discardStaleFrame({ state }, token, response)).toBe(true);
    expect(close).toHaveBeenCalledOnce();
    expect(state.staleResponses).toBe(1);
  });
  it("requires the same template incarnation, frame sequence and runtime generation", () => {
    const template = { id: "same-id" };
    const state = {
      currentTemplate: template,
      frameSequence: 2,
      sandboxRuntimeGeneration: 1,
    };
    expect(isCurrentFrame(state, template, 2, 1)).toBe(true);
    expect(isCurrentFrame(state, { id: "same-id" }, 2, 1)).toBe(false);
    expect(isCurrentFrame(state, template, 1, 1)).toBe(false);
    expect(isCurrentFrame(state, template, 2, 0)).toBe(false);
    expect(
      isCurrentFrame({ ...state, currentTemplate: null }, template, 2, 1),
    ).toBe(false);
  });
  it("parses only bounded typed observations without coercion", () => {
    const value = observation();
    expect(parseFrameObservation(JSON.stringify(value))).toEqual(value);
    for (const invalid of [
      { ...value, sequence: "2" },
      { ...value, time: -1 },
      { ...value, scale: 0 },
      { ...value, generation: 1.5 },
      { ...value, bindings: {} },
      { ...value, bindings: { ...value.bindings, controls: [null] } },
    ])
      expect(parseFrameObservation(JSON.stringify(invalid))).toBeNull();
    expect(parseFrameObservation("{")).toBeNull();
    expect(parseFrameObservation(value)).toBeNull();
    value.bindings.controls = Array.from({ length: 50_001 }, () => "x");
    expect(parseFrameObservation(JSON.stringify(value))).toBeNull();
  });
});
