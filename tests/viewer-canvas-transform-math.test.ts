import { afterEach, describe, expect, it, vi } from "vitest";

import {
  activateCanvasDrag,
  createCanvasDragPreview,
  projectCanvasTransformPreviewBox,
} from "../src/apps/viewer/canvas/drag-preview";
import {
  calculateCanvasAnchorMove,
  calculateCanvasResize,
  normalizeCanvasAngleDelta,
  rotateCanvasVector,
} from "../src/apps/viewer/canvas/transform-math";
import { resolveNumericTrack } from "../src/apps/viewer/canvas/numeric-track";

describe("viewer canvas transform math", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("starts an edit only after crossing the drag threshold", () => {
    const ctx = { state: { dragMoved: false } } as any;
    let starts = 0;

    expect(activateCanvasDrag(ctx, 2, () => starts++)).toBe(false);
    expect(ctx.state.dragMoved).toBe(false);
    expect(activateCanvasDrag(ctx, 3, () => starts++)).toBe(true);
    expect(activateCanvasDrag(ctx, 4, () => starts++)).toBe(true);
    expect(starts).toBe(1);
  });

  it("coalesces raw pointer updates into one interactive frame", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const renders: any[] = [];
    const ctx = {
      refs: { canvasSelectionBox: { dataset: {} } },
      renderCurrentFrame(options) {
        renders.push(options);
      },
      state: { previewCacheEnabled: false },
    } as any;
    const updates: number[] = [];
    const preview = createCanvasDragPreview(ctx);

    preview.scheduleUpdate(() => updates.push(1));
    preview.scheduleUpdate(() => updates.push(2));
    expect(frames).toHaveLength(1);
    expect(updates).toEqual([]);

    frames[0](0);
    expect(updates).toEqual([2]);
    expect(renders).toEqual([{ interactive: true }]);
    expect(ctx.state.canvasTransformDragActive).toBe(true);

    preview.finalize();
    expect(ctx.state.canvasTransformDragActive).toBe(false);
    expect(ctx.refs.canvasSelectionBox.dataset.transforming).toBeUndefined();
  });

  it("defers heavy canvas renders while cached-mode pointer updates continue", () => {
    vi.useFakeTimers();
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const ctx = {
      refs: { canvasSelectionBox: { dataset: {} } },
      renderCurrentFrame: vi.fn(),
      state: { previewCacheEnabled: true },
    } as any;
    const preview = createCanvasDragPreview(ctx);

    preview.scheduleUpdate(vi.fn());
    frames.shift()?.(0);
    vi.advanceTimersByTime(119);
    expect(ctx.renderCurrentFrame).not.toHaveBeenCalled();

    preview.scheduleUpdate(vi.fn());
    frames.shift()?.(16);
    vi.advanceTimersByTime(119);
    expect(ctx.renderCurrentFrame).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(ctx.renderCurrentFrame).toHaveBeenCalledWith({ interactive: true });

    preview.scheduleUpdate(vi.fn());
    frames.shift()?.(32);
    preview.finalize();
    vi.advanceTimersByTime(120);
    expect(ctx.renderCurrentFrame).toHaveBeenCalledOnce();
  });

  it("keeps renderer-derived bounds stable while translating a layer", () => {
    const before = {
      height: 224,
      rotation: 0,
      width: 224,
      x: 528,
      y: 260,
    };
    const after = projectCanvasTransformPreviewBox({
      box: before,
      next: { x: 80, y: 35 },
      original: {
        anchorX: 0,
        anchorY: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        x: 0,
        y: 0,
      },
    });

    expect(after).toEqual({
      height: 224,
      rotation: 0,
      width: 224,
      x: 608,
      y: 295,
    });
  });

  it("resizes from an edge while keeping the opposing edge fixed", () => {
    const result = resize({ x: 20, y: 0 }, "e");

    expect(result.scaleX).toBeCloseTo(1.2);
    expect(result.scaleY).toBeCloseTo(1);
    expect(result.x).toBeCloseTo(10);
    expect(result.y).toBeCloseTo(0);
    expectFixedCorner(result, 0, 0);
  });

  it("maps resize deltas into the local axes of a rotated layer", () => {
    const result = resize({ x: 0, y: 20 }, "e", { rotation: 90 });

    expect(result.scaleX).toBeCloseTo(1.2);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(10);
    expectFixedCorner(result, 0, 0, 90);
  });

  it("preserves the aspect ratio for shift-corner resize", () => {
    const result = resize({ x: 20, y: 5 }, "se", { lockAspect: true });

    expect(result.scaleX).toBeCloseTo(1.2);
    expect(result.scaleY).toBeCloseTo(1.2);
    expectFixedCorner(result, 0, 0);
  });

  it.each([
    ["nw", { x: -12, y: -8 }, 1, 1],
    ["n", { x: 0, y: -8 }, 0.5, 1],
    ["ne", { x: 12, y: -8 }, 0, 1],
    ["e", { x: 12, y: 0 }, 0, 0.5],
    ["se", { x: 12, y: 8 }, 0, 0],
    ["s", { x: 0, y: 8 }, 0.5, 0],
    ["sw", { x: -12, y: 8 }, 1, 0],
    ["w", { x: -12, y: 0 }, 1, 0.5],
  ])(
    "keeps the opposing point fixed for the %s handle",
    (handle, localDelta, x, y) => {
      const rotation = 31;
      const result = resize(rotateCanvasVector(localDelta, rotation), handle, {
        rotation,
      });

      expectFixedCorner(result, x, y, rotation);
    },
  );

  it("moves a rotated anchor without moving the rendered layer", () => {
    const result = calculateCanvasAnchorMove({
      anchor: { x: 0, y: 0 },
      box: TEST_BOX,
      delta: { x: 0, y: 20 },
      original: TEST_TRANSFORM,
      rotation: 90,
    });

    expect(result.anchorX).toBeCloseTo(0.2);
    expect(result.anchorY).toBeCloseTo(0);
    expect(result.x).toBeCloseTo(-20);
    expect(result.y).toBeCloseTo(20);
  });

  it("compensates anchor movement on a scaled layer", () => {
    const result = calculateCanvasAnchorMove({
      anchor: { x: 0, y: 0 },
      box: { ...TEST_BOX, width: 200 },
      delta: { x: 20, y: 0 },
      original: { ...TEST_TRANSFORM, scaleX: 2 },
      rotation: 0,
    });

    expect(result.anchorX).toBeCloseTo(0.1);
    expect(result.x).toBeCloseTo(10);
  });

  it("normalizes rotation across the 360-degree boundary", () => {
    expect(normalizeCanvasAngleDelta(358)).toBe(-2);
    expect(normalizeCanvasAngleDelta(-358)).toBe(2);
  });

  it.each(["linear", "in", "out", "inOut", "hold", "bezier"])(
    "samples %s tracks with the renderer easing contract",
    (easing) => {
      const from = {
        easing,
        handles: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
        time: 0,
        value: 0,
      };
      const track = {
        keyframes: [from, { time: 1, value: 100 }],
      };
      const expectedProgress = {
        bezier: 0.8024,
        hold: 0,
        in: 0.125,
        inOut: 0.5,
        linear: 0.5,
        out: 0.875,
      }[easing];

      expect(
        resolveNumericTrack({ deps: { clamp } } as any, track, 0.5, 0),
      ).toBeCloseTo(expectedProgress * 100, easing === "bezier" ? 1 : 6);
    },
  );

  it("matches renderer ownership gates for scenes, phases, and keyframes", () => {
    const timeline = {
      phases: [{ enabled: false, id: "disabled-phase", sceneId: "main" }],
      scenes: [{ enabled: true, id: "main" }],
    };
    const track = {
      keyframes: [
        { phaseId: "disabled-phase", time: 0, value: 90 },
        { time: 0, value: 10 },
        { enabled: false, time: 0.5, value: 80 },
        { time: 1, value: 30 },
      ],
    };

    expect(
      resolveNumericTrack({ deps: { clamp } } as any, track, 0.5, 5, timeline),
    ).toBe(20);
    expect(
      resolveNumericTrack(
        { deps: { clamp } } as any,
        { ...track, phaseId: "disabled-phase" },
        0.5,
        5,
        timeline,
      ),
    ).toBe(5);
  });

  it("uses the canonical motion path for paired spatial tracks", () => {
    const timeline: any = {
      motionPaths: [
        {
          layerId: "card",
          points: [
            {
              kind: "corner",
              outTangent: { x: 100, y: 0 },
              xKeyframeId: "x-a",
              yKeyframeId: "y-a",
            },
            {
              inTangent: { x: 0, y: -100 },
              kind: "corner",
              xKeyframeId: "x-b",
              yKeyframeId: "y-b",
            },
          ],
        },
      ],
      phases: [],
      scenes: [],
      tracks: [
        {
          id: "card.x",
          keyframes: [
            { easing: "linear", id: "x-a", time: 0, value: 0 },
            { easing: "linear", id: "x-b", time: 1, value: 100 },
          ],
          layerId: "card",
          property: "x",
        },
        {
          id: "card.y",
          keyframes: [
            { easing: "linear", id: "y-a", time: 0, value: 0 },
            { easing: "linear", id: "y-b", time: 1, value: 100 },
          ],
          layerId: "card",
          property: "y",
        },
      ],
    };

    expect(
      resolveNumericTrack(
        { deps: { clamp } } as any,
        timeline.tracks[0],
        0.5,
        0,
        timeline,
      ),
    ).toBe(87.5);
    expect(
      resolveNumericTrack(
        { deps: { clamp } } as any,
        timeline.tracks[1],
        0.5,
        0,
        timeline,
      ),
    ).toBe(12.5);
  });
});

const TEST_BOX = { height: 50, width: 100, x: 0, y: 0 };
const TEST_TRANSFORM = { scaleX: 1, scaleY: 1, x: 0, y: 0 };
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function resize(
  delta: { x: number; y: number },
  handle: string,
  options: { lockAspect?: boolean; rotation?: number } = {},
) {
  return calculateCanvasResize({
    anchor: { x: 0, y: 0 },
    box: TEST_BOX,
    delta,
    handle,
    lockAspect: options.lockAspect ?? false,
    original: TEST_TRANSFORM,
    rotation: options.rotation ?? 0,
  });
}

function expectFixedCorner(result, xFactor, yFactor, rotation = 0) {
  const before = corner(TEST_BOX, TEST_TRANSFORM, xFactor, yFactor, rotation);
  const after = corner(TEST_BOX, result, xFactor, yFactor, rotation);
  expect(after.x).toBeCloseTo(before.x);
  expect(after.y).toBeCloseTo(before.y);
}

function corner(box, transform, xFactor, yFactor, rotation) {
  const baseWidth = box.width / TEST_TRANSFORM.scaleX;
  const baseHeight = box.height / TEST_TRANSFORM.scaleY;
  const width = baseWidth * transform.scaleX;
  const height = baseHeight * transform.scaleY;
  const x =
    box.x +
    (transform.x - TEST_TRANSFORM.x) -
    0.5 * baseWidth * (transform.scaleX - TEST_TRANSFORM.scaleX);
  const y =
    box.y +
    (transform.y - TEST_TRANSFORM.y) -
    0.5 * baseHeight * (transform.scaleY - TEST_TRANSFORM.scaleY);
  const pivot = { x: x + width * 0.5, y: y + height * 0.5 };
  const offset = rotateCanvasVector(
    { x: (xFactor - 0.5) * width, y: (yFactor - 0.5) * height },
    rotation,
  );
  return { x: pivot.x + offset.x, y: pivot.y + offset.y };
}
