import { afterEach, describe, expect, it, vi } from "vitest";
import { createGraphViewportPreview } from "../src/apps/viewer/graph-editor/viewport-preview.js";
import {
  createGraphEditorState,
  type GraphEditorViewport,
} from "../src/apps/viewer/graph-editor/state.js";

describe("graph viewport preview authority", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("coalesces moves and accepts consecutive own viewport revisions", () => {
    const { ctx, source, frames, initial } = fixture();
    const preview = createGraphViewportPreview(ctx, source);
    preview.schedule({ ...initial, timeStart: 0.1 });
    const second = { ...initial, timeStart: 0.2 };
    preview.schedule(second);
    frames[0]?.(0);
    expect(ctx.setGraphEditorViewport).toHaveBeenCalledExactlyOnceWith(second);
    const third = { ...initial, timeStart: 0.3 };
    preview.schedule(third);
    frames[1]?.(0);
    expect(ctx.setGraphEditorViewport).toHaveBeenLastCalledWith(third);
    preview.finalize();
    expect(ctx.state.graphEditorPanSession).toBeNull();
  });

  it.each(["source", "viewport", "close"])(
    "rejects queued moves after %s changes",
    (changed) => {
      const { ctx, source, initial, frames } = fixture();
      const preview = createGraphViewportPreview(ctx, source);
      preview.schedule({ ...initial, timeStart: 0.1 });
      if (changed === "source") ctx.state.currentTemplate = { ...source };
      else if (changed === "viewport")
        ctx.state.graphEditorViewport = { ...initial };
      else ctx.state.graphEditorEnabled = false;
      frames[0]?.(0);
      preview.finalize();
      expect(ctx.setGraphEditorViewport).not.toHaveBeenCalled();
      expect(ctx.state.graphEditorPanSession).toBeNull();
    },
  );

  it("does not replay a dequeued callback or accept work after finalization", () => {
    const { ctx, source, initial, frames } = fixture();
    const preview = createGraphViewportPreview(ctx, source);
    preview.schedule({ ...initial, timeStart: 0.1 });
    const queued = frames[0];
    preview.finalize();
    queued?.(0);
    preview.schedule({ ...initial, timeStart: 0.2 });
    preview.finalize();
    expect(ctx.setGraphEditorViewport).toHaveBeenCalledTimes(1);
  });

  it("does not let an old callback or finalizer overwrite a new session", () => {
    const { ctx, source, initial, frames } = fixture();
    const first = createGraphViewportPreview(ctx, source);
    first.schedule({ ...initial, timeStart: 0.1 });
    const second = createGraphViewportPreview(ctx, source);
    const session = ctx.state.graphEditorPanSession;
    first.finalize();
    frames[0]?.(0);
    expect(ctx.state.graphEditorPanSession).toBe(session);
    second.schedule({ ...initial, timeStart: 0.2 });
    frames[1]?.(0);
    expect(ctx.setGraphEditorViewport).toHaveBeenCalledOnce();
    second.finalize();
    expect(ctx.state.graphEditorPanSession).toBeNull();
  });
});

function fixture() {
  const source = { id: "source" };
  const initial = {
    templateId: "source",
    timeStart: 0,
    timeEnd: 4,
    valueMin: 0,
    valueMax: 1,
  };
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    frames.push(callback),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const ctx = {
    state: {
      ...createGraphEditorState(),
      currentTemplate: source,
      graphEditorEnabled: true,
      graphEditorViewport: initial,
    },
    setGraphEditorViewport: vi.fn<(viewport: GraphEditorViewport) => void>(
      (viewport: GraphEditorViewport) => {
        ctx.state.graphEditorViewport = viewport;
      },
    ),
  };
  return { ctx, source, initial, frames };
}
