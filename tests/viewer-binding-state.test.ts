import { afterEach, describe, expect, it, vi } from "vitest";
import { createViewerState } from "../src/apps/viewer/app/state.js";
import {
  createEmptyBindingReads,
  normalizeBindingReads,
  formatBindingReadsTitle,
} from "../src/apps/viewer/app/binding-reads.js";
import { beginViewerRenderProfile } from "../src/apps/viewer/rendering/render-profile-state.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("renderer binding and profile boundaries", () => {
  it("rejects malformed records without object coercion or source mutation", () => {
    const coercion = vi.fn(() => {
      throw new Error("Unexpected metadata coercion");
    });
    const invalid = { toString: coercion, valueOf: coercion };
    const bounds = { layerId: "title", x: "1", y: 2, width: 100, height: 20 };
    const raw = {
      controls: [2, "2", "", invalid, null],
      primitiveBounds: [
        null,
        bounds,
        { ...bounds, layerId: "bad", width: invalid },
      ],
    };
    const parsed = normalizeBindingReads(raw);
    expect(parsed.controls).toEqual(["2"]);
    expect(parsed.primitiveBounds).toEqual([
      { layerId: "title", x: 1, y: 2, width: 100, height: 20 },
    ]);
    expect(raw.primitiveBounds[1]).toBe(bounds);
    expect(bounds.x).toBe("1");
    expect(formatBindingReadsTitle(raw)).toBe(
      "Renderer bindings\nprimitive bounds: title\ncontrols: 2",
    );
    expect(coercion).not.toHaveBeenCalled();
  });

  it("treats non-record telemetry as empty", () => {
    for (const input of [null, undefined, [], 42, "reads"])
      expect(normalizeBindingReads(input)).toEqual(createEmptyBindingReads());
  });

  it("keeps a finished timing snapshot stable after later marks", () => {
    vi.spyOn(performance, "now")
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(103)
      .mockReturnValueOnce(110)
      .mockReturnValueOnce(115);
    const ctx = { state: createViewerState() };
    const profile = beginViewerRenderProfile(true);
    if (!profile) throw new Error("Expected an enabled profile.");
    profile.mark("modelMs");
    profile.finish(ctx, {
      height: 720,
      width: 1280,
      templateId: "source",
      time: 0,
    });
    const snapshot = ctx.state.lastRenderProfile;
    expect(snapshot).toMatchObject({
      totalMs: 10,
      sandbox: null,
      viewer: { modelMs: 3, assetsMs: 0 },
    });
    profile.mark("assetsMs");
    expect(snapshot?.viewer.assetsMs).toBe(0);
    expect(Object.values(snapshot?.viewer ?? {}).every(Number.isFinite)).toBe(
      true,
    );
  });

  it("does not read the clock when profiling is disabled", () => {
    const now = vi.spyOn(performance, "now");
    expect(beginViewerRenderProfile(false)).toBeNull();
    expect(now).not.toHaveBeenCalled();
  });
});
