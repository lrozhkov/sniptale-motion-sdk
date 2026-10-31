import { createViewerInteractionState } from "../src/apps/viewer/app/interaction-state.js";
import { describe, expect, it, vi } from "vitest";
import type { ViewerAppContext } from "../src/apps/viewer/app/context";
import { selectTemplate } from "../src/apps/viewer/templates/selection";
import { createViewerTemplateState } from "../src/apps/viewer/templates/state";
import { readEditorTemplateSource } from "../src/apps/viewer/templates/source";

function fixture() {
  const current = readEditorTemplateSource({ id: "current", duration: 1 });
  const next = readEditorTemplateSource({ id: "next", duration: 1 });
  const state = {
    ...createViewerTemplateState(),
    ...createViewerInteractionState(),
  };
  state.currentTemplate = current;
  state.templates = [current, next];
  const flush = vi.fn(async () => {});
  // These cases stop at the selection gate, before UI or renderer access.
  const ctx = { state, flushEditorDraft: flush } as unknown as ViewerAppContext;
  return { ctx, state, flush, current };
}

describe("template selection authority after draft flush", () => {
  it("rechecks the editor guard after asynchronous persistence", async () => {
    const { ctx, state, flush, current } = fixture();
    const pending = Promise.withResolvers<void>();
    flush.mockReturnValueOnce(pending.promise);
    let unchanged = true;
    const beforeReset = vi.fn();
    const selecting = selectTemplate(ctx, "next", {
      canSelect: () => unchanged,
      beforeReset,
    });
    expect(state.templateSelectionPending).toBe(true);
    unchanged = false;
    pending.resolve();
    expect(await selecting).toBe(false);
    expect(beforeReset).not.toHaveBeenCalled();
    expect(state.currentTemplate).toBe(current);
    expect(state.templateSelectionPending).toBe(false);
  });

  it("finishes the active gesture before flushing the old document draft", async () => {
    const { ctx, state, flush, current } = fixture();
    let finalGesture = 0;
    const cancel = vi.fn(() => {
      finalGesture = 1;
      state.pointerDragCleanup = null;
    });
    state.pointerDragCleanup = cancel;
    flush.mockImplementation(async () => {
      expect(finalGesture).toBe(1);
    });
    expect(await selectTemplate(ctx, "next", { canSelect: () => false })).toBe(
      false,
    );
    expect(cancel).toHaveBeenCalledOnce();
    expect(state.currentTemplate).toBe(current);
  });

  it("rejects an older selection without releasing the newer selection's lock", async () => {
    const { ctx, state, flush, current } = fixture();
    const firstFlush = Promise.withResolvers<void>();
    const secondFlush = Promise.withResolvers<void>();
    flush.mockReturnValueOnce(firstFlush.promise);
    flush.mockReturnValueOnce(secondFlush.promise);
    const firstReset = vi.fn();
    const secondReset = vi.fn();
    const first = selectTemplate(ctx, "next", { beforeReset: firstReset });
    const second = selectTemplate(ctx, "current", {
      canSelect: () => false,
      beforeReset: secondReset,
    });
    firstFlush.resolve();
    expect(await first).toBe(false);
    expect(firstReset).not.toHaveBeenCalled();
    expect(state.templateSelectionPending).toBe(true);
    secondFlush.resolve();
    expect(await second).toBe(false);
    expect(secondReset).not.toHaveBeenCalled();
    expect(state.currentTemplate).toBe(current);
    expect(state.templateSelectionPending).toBe(false);
  });
});
