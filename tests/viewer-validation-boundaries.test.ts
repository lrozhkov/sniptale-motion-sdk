import { describe, expect, it, vi } from "vitest";
import {
  collectEditorValidationIssues,
  isRangeInvalid,
} from "../src/apps/viewer/validation/model";

const valid = () => ({
  duration: 2,
  layers: [{ id: "card", type: "rect" }],
  clips: [{ layerId: "card", start: 0, duration: 2 }],
  scenes: [],
  timeline: { phases: [], tracks: [] },
});
describe("editor validation receiving boundaries", () => {
  it.each([
    true,
    12,
    "document",
    [],
    { duration: 2, layers: {} },
    { duration: 2, layers: [null] },
    { duration: 2, timeline: { tracks: {} } },
    { duration: 2, timeline: { tracks: [{ id: "track", keyframes: [null] }] } },
  ])("reports malformed structure without throwing: %j", (value) => {
    const issues = collectEditorValidationIssues(value);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((issue) => typeof issue.messageKey === "string")).toBe(
      true,
    );
  });
  it.each([true, "2", [2], Infinity, NaN])(
    "rejects nonfinite or nonnumeric timing: %j",
    (duration) => {
      expect(
        collectEditorValidationIssues({ ...valid(), duration }),
      ).not.toEqual([]);
      expect(isRangeInvalid(0, duration, 2)).toBe(true);
    },
  );
  it("does not invoke conversion hooks in timing, references or assets", () => {
    const convert = vi.fn(() => {
      throw new Error("foreign conversion");
    });
    const foreign = { toString: convert, valueOf: convert };
    for (const value of [
      { ...valid(), duration: foreign },
      { ...valid(), clips: [{ layerId: foreign, start: 0, duration: 1 }] },
      { ...valid(), assets: [foreign] },
    ]) {
      expect(collectEditorValidationIssues(value).length).toBeGreaterThan(0);
    }
    expect(convert).not.toHaveBeenCalled();
  });
  it("reports malformed preset content instead of replacing it with an empty collection", () => {
    expect(
      collectEditorValidationIssues({
        ...valid(),
        presets: [{ id: "bad", layers: {} }],
      }).some((issue) => issue.presetId === "bad"),
    ).toBe(true);
  });
  it("identifies the first invalid field for correction", () => {
    expect(
      collectEditorValidationIssues({
        ...valid(),
        timeline: { tracks: [{ id: "card.x", keyframes: [{ time: "0.5" }] }] },
      })[0]?.messageParams,
    ).toEqual({ path: "$.timeline.tracks[0].keyframes[0].time" });
  });
  it.each([null, {}, false])(
    "does not silently repair preset layer collections: %j",
    (layers) => {
      expect(
        collectEditorValidationIssues({
          ...valid(),
          presets: [{ id: "bad", layers }],
        }).some((issue) => issue.presetId === "bad"),
      ).toBe(true);
    },
  );
  it("rejects holes in a receiving array", () => {
    const layers = new Array(1);
    expect(collectEditorValidationIssues({ ...valid(), layers })).not.toEqual(
      [],
    );
  });
  it("checks asset metadata types before safety callbacks", () => {
    const convert = vi.fn(() => {
      throw new Error("foreign conversion");
    });
    const foreign = { toString: convert };
    const safety = vi.fn((value: unknown) => String(value) === "safe");
    expect(
      collectEditorValidationIssues(
        { ...valid(), assets: ["mark"] },
        {
          assets: new Map([["mark", { path: foreign, svgText: foreign }]]),
          isSafeLocalAssetPath: safety,
          isSafeSvgAssetText: safety,
        },
      ).length,
    ).toBeGreaterThan(0);
    expect(safety).not.toHaveBeenCalled();
    expect(convert).not.toHaveBeenCalled();
  });
  it("keeps a valid document valid and does not modify input", () => {
    const document = valid();
    const before = JSON.stringify(document);
    expect(collectEditorValidationIssues(document)).toEqual([]);
    expect(JSON.stringify(document)).toBe(before);
  });
});
