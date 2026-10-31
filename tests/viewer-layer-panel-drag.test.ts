import { afterEach, describe, expect, it, vi } from "vitest";
import { createLayerOrderActions } from "../src/apps/viewer/layers/order";
import { createLayerHierarchyIndex } from "../src/apps/viewer/layers/hierarchy";
import { createViewerState } from "../src/apps/viewer/app/state";

afterEach(() => vi.unstubAllGlobals());
describe("layer panel order drag authority", () => {
  it("commits once and cannot apply retained callbacks after finalization", () => {
    const f = fixture();
    f.move(-40);
    f.flush();
    f.end();
    expect(f.ctx.beginEditorCommand).toHaveBeenCalledOnce();
    expect(f.ctx.setEditorOverride).toHaveBeenCalledOnce();
    expect(
      f.ctx.setEditorOverride.mock.calls[0][0].layers.map(
        (layer: { id: string }) => layer.id,
      ),
    ).toEqual(["b", "a"]);
    f.move(0);
    f.flush();
    f.end();
    expect(f.ctx.setEditorOverride).toHaveBeenCalledOnce();
    expect(f.state.timelineDragActive).toBe(false);
  });
  it("replaces a pending move with the original order when the pointer returns before RAF", () => {
    const f = fixture();
    f.move(-40);
    f.move(0);
    f.flush();
    f.end();
    expect(f.ctx.setEditorOverride).toHaveBeenCalledOnce();
    expect(
      f.ctx.setEditorOverride.mock.calls[0][0].layers.map(
        (layer: { id: string }) => layer.id,
      ),
    ).toEqual(["a", "b"]);
  });
  it.each(["source", "editor", "timeline"] as const)(
    "discards queued order after %s replacement",
    (owner) => {
      const f = fixture();
      f.move(-40);
      if (owner === "source") f.state.currentTemplate = { ...f.source };
      else if (owner === "editor") f.state.editorOverrides.set("source", {});
      else f.state.timelineOverrides.set("source", {});
      f.flush();
      f.end();
      expect(f.ctx.setEditorOverride).not.toHaveBeenCalled();
      expect(f.state.timelineDragActive).toBe(false);
    },
  );
});
function fixture() {
  const source = { id: "source", duration: 2 };
  const layers = [
    { id: "a", type: "rect" },
    { id: "b", type: "rect" },
  ];
  const state = createViewerState();
  state.currentTemplate = source;
  const callbacks = new Map<number, FrameRequestCallback>();
  let sequence = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callbacks.set(++sequence, callback);
    return sequence;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => callbacks.delete(id));
  class Row {
    closest(selector: string) {
      return selector === ".layer-row" ? this : null;
    }
    getBoundingClientRect() {
      return { height: 40 };
    }
  }
  vi.stubGlobal("Element", Row);
  vi.stubGlobal("HTMLElement", Row);
  let move = (_event: { clientY: number }) => {};
  let end = () => {};
  const ctx = {
    state,
    deps: { deepClone: structuredClone },
    getEffectiveTemplate: () => ({
      ...source,
      layers,
      clips: [],
      scenes: [],
      timeline: { duration: 2, phases: [], tracks: [] },
    }),
    getLayerHierarchy: () => createLayerHierarchyIndex(layers),
    selectLayer: vi.fn(),
    beginEditorCommand: vi.fn(),
    setEditorOverride: vi.fn((value: unknown) =>
      state.editorOverrides.set(source.id, value),
    ),
    renderTimelineEditor: vi.fn(),
    renderCurrentFrame: vi.fn(async () => {}),
    settlePreviewAfterInteraction: vi.fn(async () => {}),
    bindPointerDrag: (
      _id: number,
      _target: unknown,
      onMove: typeof move,
      onEnd: typeof end,
    ) => {
      state.dragMoved = false;
      move = onMove;
      end = onEnd;
    },
  } as any;
  Object.assign(
    ctx,
    createLayerOrderActions(() => ctx),
  );
  const row = new Row();
  ctx.beginLayerPanelDrag(
    {
      button: 0,
      target: row,
      currentTarget: row,
      pointerId: 1,
      clientY: 0,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    },
    "a",
  );
  return {
    ctx,
    state,
    source,
    move: (clientY: number) => move({ clientY }),
    end: () => end(),
    flush: () => {
      const queued = [...callbacks.values()];
      callbacks.clear();
      for (const callback of queued) callback(0);
    },
  };
}
