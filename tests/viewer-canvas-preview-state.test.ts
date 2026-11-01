import { afterEach, describe, expect, it, vi } from "vitest";
import { createViewerState } from "../src/apps/viewer/app/state.js";
import {
  createCanvasDragPreview,
  invalidateCanvasDragPreview,
} from "../src/apps/viewer/canvas/drag-preview.js";
import type { EffectLayer } from "../src/sdk/types.js";
import type { CanvasTransformValues } from "../src/apps/viewer/canvas/transform-state.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

function context() {
  const state = createViewerState();
  state.currentTemplate = { id: "source", duration: 1 };
  const values: CanvasTransformValues = {
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    anchorX: 0,
    anchorY: 0,
  };
  const dataset: DOMStringMap = {};
  return {
    state,
    refs: { canvasSelectionBox: { dataset } },
    renderCurrentFrame: vi.fn<() => Promise<undefined>>(async () => undefined),
    getResolvedLayerAnchor: () => ({ x: 0, y: 0 }),
    getResolvedLayerProperty: (
      _layer: EffectLayer,
      property: keyof CanvasTransformValues,
    ) => values[property],
  };
}
const options = {
  layerId: "title",
  layer: { id: "title", type: "rect" },
  box: { height: 20, width: 100, rotation: 0, x: 0, y: 0 },
};

describe("canvas preview state ownership", () => {
  it("starts its command once after crossing the movement threshold", () => {
    const ctx = context();
    const preview = createCanvasDragPreview(ctx);
    const start = vi.fn<() => void>();
    expect(preview.activate(2, start)).toBe(false);
    expect(ctx.state.dragMoved).toBe(false);
    expect(preview.activate(3, start)).toBe(true);
    expect(preview.activate(4, start)).toBe(true);
    expect(start).toHaveBeenCalledTimes(1);
    preview.finalize();
    expect(preview.activate(4, start)).toBe(false);
  });

  it.each(["source", "replacement", "finalized", "history"] as const)(
    "does not begin a command through an obsolete %s gesture",
    (change) => {
      const ctx = context();
      const preview = createCanvasDragPreview(ctx, options);
      if (change === "source")
        ctx.state.currentTemplate = { id: "source", duration: 2 };
      if (change === "replacement") createCanvasDragPreview(ctx, options);
      if (change === "finalized") preview.finalize();
      if (change === "history")
        invalidateCanvasDragPreview(ctx.state, ctx.refs.canvasSelectionBox);
      const start = vi.fn<() => void>();
      expect(preview.activate(4, start)).toBe(false);
      expect(start).not.toHaveBeenCalled();
      expect(ctx.state.dragMoved).toBe(false);
    },
  );

  it("keeps the new handle active when neither operation has a preview object", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn<() => void>());
    const ctx = context();
    const old = createCanvasDragPreview(ctx);
    const update = vi.fn<() => void>();
    old.scheduleUpdate(update);
    const current = createCanvasDragPreview(ctx);
    frames.shift()?.(0);
    expect(update).not.toHaveBeenCalled();
    expect(old.isCurrent()).toBe(false);
    expect(current.isCurrent()).toBe(true);
    old.finalize();
    expect(ctx.state.canvasTransformDragActive).toBe(true);
    expect(ctx.refs.canvasSelectionBox.dataset.transforming).toBe("true");
    current.finalize();
    expect(ctx.state.canvasTransformDragActive).toBe(false);
  });

  it("invalidates callbacks and clears the DOM flag after a source or history restore", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn<() => void>());
    const ctx = context();
    const old = createCanvasDragPreview(ctx);
    const update = vi.fn<() => void>();
    old.scheduleUpdate(update);
    invalidateCanvasDragPreview(ctx.state, ctx.refs.canvasSelectionBox);
    frames.shift()?.(0);
    old.finalize(update);
    expect(update).not.toHaveBeenCalled();
    expect(old.isCurrent()).toBe(false);
    expect(ctx.state.canvasTransformDragActive).toBe(false);
    expect(ctx.state.canvasTransformPreview).toBeNull();
    expect(ctx.refs.canvasSelectionBox.dataset.transforming).toBeUndefined();
  });

  it("does not update or finalize a replacement preview for the same layer", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn<() => void>());
    const ctx = context();
    ctx.state.dragMoved = true;
    const old = createCanvasDragPreview(ctx, options);
    const update = vi.fn<() => void>();
    old.scheduleUpdate(update);
    const current = createCanvasDragPreview(ctx, options);
    const snapshot = ctx.state.canvasTransformPreview;
    frames.shift()?.(0);
    old.updateTransform({ x: 100 });
    const finalUpdate = vi.fn<() => void>();
    old.finalize(finalUpdate);
    expect(update).not.toHaveBeenCalled();
    expect(finalUpdate).not.toHaveBeenCalled();
    expect(ctx.state.canvasTransformPreview).toBe(snapshot);
    expect(snapshot?.box?.x).toBe(0);
    expect(snapshot?.awaitingFullRender).toBe(false);
    expect(ctx.state.canvasTransformDragActive).toBe(true);
    expect(ctx.refs.canvasSelectionBox.dataset.transforming).toBe("true");
    current.updateTransform({ x: 10 });
    expect(ctx.state.canvasTransformPreview?.box?.x).toBe(10);
    current.finalize();
  });

  it("rejects a stale source reference even when the template id is unchanged", () => {
    const ctx = context();
    const old = createCanvasDragPreview(ctx, options);
    ctx.state.currentTemplate = { id: "source", duration: 2 };
    const update = vi.fn<() => void>();
    old.updateTransform({ x: 100 });
    old.finalize(update);
    expect(update).not.toHaveBeenCalled();
    expect(ctx.state.canvasTransformPreview?.box?.x).toBe(0);
  });

  it("cleans its own state without swallowing a failed final update", () => {
    const ctx = context();
    const preview = createCanvasDragPreview(ctx, options);
    expect(() =>
      preview.finalize(() => {
        throw new Error("Edit failed");
      }),
    ).toThrow("Edit failed");
    expect(ctx.state.canvasTransformDragActive).toBe(false);
    expect(ctx.state.canvasTransformPreview).toBeNull();
    expect(ctx.refs.canvasSelectionBox.dataset.transforming).toBeUndefined();
  });

  it("does not apply single-layer geometry through a selection preview", () => {
    const ctx = context();
    ctx.state.canvasTransformPreview = {
      awaitingFullRender: false,
      templateId: "source",
      boxes: { title: options.box },
    };
    const preview = createCanvasDragPreview(ctx);
    expect(() => preview.updateTransform({ x: 10 })).not.toThrow();
    expect(ctx.state.canvasTransformPreview.boxes?.title?.x).toBe(0);
    preview.finalize();
  });
});
