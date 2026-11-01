import { afterEach, describe, expect, it, vi } from "vitest";
import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import { requiredEntry } from "./helpers/required-entry.js";
import type { ViewerAppContext } from "../src/apps/viewer/app/context.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("layer panel order drag authority", () => {
  it("commits once and cannot apply retained callbacks after finalization", () => {
    const f = fixture();
    f.move(-40);
    f.flush();
    f.end();
    expect(f.ctx.beginEditorCommand).toHaveBeenCalledOnce();
    expect(f.ctx.setEditorOverride).toHaveBeenCalledOnce();
    expect(
      requiredEntry(f.ctx.setEditorOverride.mock.calls, 0)[0],
    ).toMatchObject({ layers: [{ id: "b" }, { id: "a" }] });
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
      requiredEntry(f.ctx.setEditorOverride.mock.calls, 0)[0],
    ).toMatchObject({ layers: [{ id: "a" }, { id: "b" }] });
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
  const ctx = createViewerContextFixture();
  const source = {
    id: "source",
    duration: 2,
    layers: [
      { id: "a", type: "rect" },
      { id: "b", type: "rect" },
    ],
    clips: [],
    scenes: [],
    timeline: { duration: 2, phases: [], tracks: [] },
  };
  const state = ctx.state;
  state.currentTemplate = source;
  const callbacks = new Map<number, FrameRequestCallback>();
  let sequence = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callbacks.set(++sequence, callback);
    return sequence;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => callbacks.delete(id));
  class Row extends EventTarget {
    closest(selector: string) {
      return selector === ".layer-row" ? this : null;
    }
    getBoundingClientRect(): DOMRect {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 100,
        bottom: 40,
        height: 40,
        width: 100,
        toJSON: () => ({}),
      };
    }
  }
  vi.stubGlobal("Element", Row);
  vi.stubGlobal("HTMLElement", Row);
  const row = new HTMLElement();
  class FixturePointerEvent {
    button = 0;
    target = row;
    currentTarget = row;
    pointerId = 1;
    clientY: number;
    constructor(_type: string, options: PointerEventInit = {}) {
      this.clientY = options.clientY ?? 0;
    }
    preventDefault(): void {}
    stopPropagation(): void {}
  }
  vi.stubGlobal("PointerEvent", FixturePointerEvent);
  let move: Parameters<ViewerAppContext["bindPointerDrag"]>[2] | undefined;
  let end: Parameters<ViewerAppContext["bindPointerDrag"]>[3];
  vi.spyOn(ctx, "selectLayer").mockImplementation(() => {});
  const beginEditorCommand = vi
    .spyOn(ctx, "beginEditorCommand")
    .mockImplementation(() => {});
  const setEditorOverride = vi
    .spyOn(ctx, "setEditorOverride")
    .mockImplementation((value) => {
      state.editorOverrides.set(source.id, value);
    });
  vi.spyOn(ctx, "renderTimelineEditor").mockImplementation(() => {});
  vi.spyOn(ctx, "renderCurrentFrame").mockResolvedValue();
  vi.spyOn(ctx, "settlePreviewAfterInteraction").mockResolvedValue(true);
  vi.spyOn(ctx, "bindPointerDrag").mockImplementation(
    (_id, _target, onMove, onEnd) => {
      state.dragMoved = false;
      move = onMove;
      end = onEnd;
    },
  );
  ctx.beginLayerPanelDrag(new PointerEvent("pointerdown"), "a");
  if (!move || !end)
    throw new Error("Layer drag callbacks were not registered.");
  const onMove = move;
  const onEnd = end;
  return {
    ctx: Object.assign(ctx, { beginEditorCommand, setEditorOverride }),
    state,
    source,
    move: (clientY: number) =>
      onMove(new PointerEvent("pointermove", { clientY })),
    end: () => onEnd(new PointerEvent("pointerup")),
    flush: () => {
      const queued = [...callbacks.values()];
      callbacks.clear();
      for (const callback of queued) callback(0);
    },
  };
}
