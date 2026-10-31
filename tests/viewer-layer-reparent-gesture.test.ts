import { afterEach, describe, expect, it, vi } from "vitest";
import { createTimelineLayerReparentActions } from "../src/apps/viewer/timeline/interaction/layer-reparent.js";
import { createViewerState } from "../src/apps/viewer/app/state.js";
import type { EditorTemplate } from "../src/apps/viewer/templates/model.js";
import { readEditorTemplateSource } from "../src/apps/viewer/templates/source.js";

afterEach(() => vi.unstubAllGlobals());

describe("layer reparent gesture authority", () => {
  it("commits a valid drop exactly once through the editor command", () => {
    const f = fixture();
    f.move();
    expect(f.row.classes.has("drop-before")).toBe(true);
    f.end("pointerup");
    expect(f.ctx.beginEditorCommand).toHaveBeenCalledExactlyOnceWith({
      type: "reparentLayers",
      payload: { layerIds: ["a"], targetLayerId: "b", position: "before" },
    });
    expect(f.ctx.setEditorOverride).toHaveBeenCalledExactlyOnceWith({
      layers: [
        expect.objectContaining({ id: "b" }),
        expect.objectContaining({ id: "a" }),
      ],
    });
    expect(f.row.classes.size).toBe(0);
  });

  it("does not commit a canceled drop", () => {
    const f = fixture();
    f.move();
    expect(f.row.classes.has("drop-before")).toBe(true);
    f.end("pointercancel");
    expect(f.ctx.beginEditorCommand).not.toHaveBeenCalled();
    expect(f.ctx.setEditorOverride).not.toHaveBeenCalled();
    expect(f.row.classes.size).toBe(0);
  });

  it.each(["source", "editor", "timeline"] as const)(
    "rejects a drop after %s replacement",
    (kind) => {
      const f = fixture();
      f.move();
      expect(f.row.classes.has("drop-before")).toBe(true);
      if (kind === "source")
        f.state.currentTemplate = readEditorTemplateSource({
          id: "source",
          duration: 4,
        });
      else if (kind === "editor") f.state.editorOverrides.set("source", {});
      else f.state.timelineOverrides.set("source", {});
      f.end("pointerup");
      expect(f.ctx.beginEditorCommand).not.toHaveBeenCalled();
      expect(f.ctx.setEditorOverride).not.toHaveBeenCalled();
      expect(f.row.classes.size).toBe(0);
    },
  );
});

function fixture() {
  vi.stubGlobal("HTMLElement", Row);
  vi.stubGlobal("PointerEvent", PointerSample);
  const row = new Row();
  vi.stubGlobal("document", { elementFromPoint: () => row });
  const state = createViewerState();
  state.currentTemplate = readEditorTemplateSource({
    id: "source",
    duration: 4,
  });
  state.selectedLayers = ["a"];
  const template: EditorTemplate = {
    id: "source",
    duration: 4,
    layers: [
      { id: "a", type: "rect" },
      { id: "b", type: "rect" },
    ],
    clips: [],
    scenes: [],
    timeline: { duration: 4, phases: [], tracks: [] },
  };
  let move: ((event: MouseEvent) => void) | null = null;
  let end: ((event: MouseEvent) => void) | null = null;
  const ctx = {
    state,
    deps: { t: (key: string, fallback = key) => fallback },
    getEffectiveTemplate: () => template,
    bindPointerDrag: (
      _id: number | null | undefined,
      _target: unknown,
      onMove: (event: MouseEvent) => void,
      onEnd?: ((event: MouseEvent) => void) | null,
    ) => {
      move = onMove;
      end = onEnd ?? null;
    },
    beginTimelineLayerReparent: () => false,
    logDiagnostic: vi.fn(),
    selectLayer: vi.fn(),
    beginEditorCommand: vi.fn(),
    setEditorOverride: vi.fn(),
    setSelectedLayers: vi.fn(),
    renderTimelineEditor: vi.fn(),
    renderCurrentFrame: vi.fn(async () => {}),
  };
  const actions = createTimelineLayerReparentActions(() => ctx);
  row.addEventListener("pointerdown", (event) => {
    if (!(event instanceof PointerEvent))
      throw new Error("Expected pointer event");
    expect(actions.beginTimelineLayerReparent(event, "a")).toBe(true);
  });
  row.dispatchEvent(new PointerEvent("pointerdown"));
  return {
    state,
    ctx,
    row,
    move: () => move?.(new PointerEvent("pointermove", { clientX: 20 })),
    end: (type: string) => end?.(new PointerEvent(type)),
  };
}
class PointerSample extends Event {
  button = 0;
  pointerId = 1;
  clientX: number;
  clientY: number;
  constructor(type: string, options: PointerEventInit = {}) {
    super(type);
    this.clientX = options.clientX ?? 0;
    this.clientY = options.clientY ?? 0;
  }
}
class Row extends EventTarget {
  dataset = { layerId: "b", layerGroupId: "" };
  classes = new Set<string>();
  classList = {
    add: (value: string) => this.classes.add(value),
    remove: (...values: string[]) => {
      for (const value of values) this.classes.delete(value);
    },
  };
  closest() {
    return this;
  }
  getBoundingClientRect() {
    return { top: 0, height: 20 };
  }
}
