import { afterEach, describe, expect, it, vi } from "vitest";
import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import { selectTemplate } from "../src/apps/viewer/templates/selection";
import { readEditorTemplateSource } from "../src/apps/viewer/templates/source";

function fixture() {
  const current = readEditorTemplateSource({ id: "current", duration: 1 });
  const next = readEditorTemplateSource({ id: "next", duration: 1 });
  const ctx = createViewerContextFixture();
  const state = ctx.state;
  state.currentTemplate = current;
  state.templates = [current, next];
  const flush = vi.spyOn(ctx, "flushEditorDraft").mockResolvedValue(true);
  return { ctx, state, flush, current };
}

describe("template selection authority after draft flush", () => {
  it("rechecks the editor guard after asynchronous persistence", async () => {
    const { ctx, state, flush, current } = fixture();
    const pending = Promise.withResolvers<boolean>();
    flush.mockReturnValueOnce(pending.promise);
    let unchanged = true;
    const beforeReset = vi.fn<() => void>();
    const selecting = selectTemplate(ctx, "next", {
      canSelect: () => unchanged,
      beforeReset,
    });
    expect(state.templateSelectionPending).toBe(true);
    unchanged = false;
    pending.resolve(true);
    expect(await selecting).toBe(false);
    expect(beforeReset).not.toHaveBeenCalled();
    expect(state.currentTemplate).toBe(current);
    expect(state.templateSelectionPending).toBe(false);
  });

  it("finishes the active gesture before flushing the old document draft", async () => {
    const { ctx, state, flush, current } = fixture();
    let finalGesture = 0;
    const cancel = vi.fn<() => void>(() => {
      finalGesture = 1;
      state.pointerDragCleanup = null;
    });
    state.pointerDragCleanup = cancel;
    flush.mockImplementation(async () => {
      expect(finalGesture).toBe(1);
      return true;
    });
    expect(await selectTemplate(ctx, "next", { canSelect: () => false })).toBe(
      false,
    );
    expect(cancel).toHaveBeenCalledOnce();
    expect(state.currentTemplate).toBe(current);
  });

  it("rejects an older selection without releasing the newer selection's lock", async () => {
    const { ctx, state, flush, current } = fixture();
    const firstFlush = Promise.withResolvers<boolean>();
    const secondFlush = Promise.withResolvers<boolean>();
    flush.mockReturnValueOnce(firstFlush.promise);
    flush.mockReturnValueOnce(secondFlush.promise);
    const firstReset = vi.fn<() => void>();
    const secondReset = vi.fn<() => void>();
    const first = selectTemplate(ctx, "next", { beforeReset: firstReset });
    const second = selectTemplate(ctx, "current", {
      canSelect: () => false,
      beforeReset: secondReset,
    });
    firstFlush.resolve(true);
    expect(await first).toBe(false);
    expect(firstReset).not.toHaveBeenCalled();
    expect(state.templateSelectionPending).toBe(true);
    secondFlush.resolve(true);
    expect(await second).toBe(false);
    expect(secondReset).not.toHaveBeenCalled();
    expect(state.currentTemplate).toBe(current);
    expect(state.templateSelectionPending).toBe(false);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
