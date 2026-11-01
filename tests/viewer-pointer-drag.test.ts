import { afterEach, describe, expect, it, vi } from "vitest";
import { createPointerDragActions } from "../src/apps/viewer/app/pointer-drag.js";
import type { PointerDragContext } from "../src/apps/viewer/app/pointer-context.js";
import type { PointerDragActions } from "../src/apps/viewer/app/pointer-contract.js";
import { requiredEntry } from "./helpers/required-entry.js";
import { createViewerState } from "../src/apps/viewer/app/state.js";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("viewer pointer drag ownership", () => {
  it("accepts moves and termination only from the captured pointer", () => {
    const { actions, target, events, ctx, setFingerprint } = fixture();
    const move = vi.fn<() => void>(() => {
      ctx.state.dragMoved = true;
      setFingerprint("changed");
    });
    const end = vi.fn<Parameters<PointerDragActions["bindPointerDrag"]>[2]>();
    actions.bindPointerDrag(1, target, move, end);
    events.dispatchEvent(new PointerSample("pointermove", 2));
    events.dispatchEvent(new PointerSample("pointerup", 2));
    expect(move).not.toHaveBeenCalled();
    expect(end).not.toHaveBeenCalled();
    events.dispatchEvent(new PointerSample("pointermove", 1));
    events.dispatchEvent(new PointerSample("pointerup", 1));
    events.dispatchEvent(new PointerSample("pointercancel", 1));
    events.dispatchEvent(new PointerSample("pointermove", 1));
    expect(move).toHaveBeenCalledOnce();
    expect(end).toHaveBeenCalledOnce();
    expect(ctx.markEditorChanged).toHaveBeenCalledExactlyOnceWith(
      "pointer-drag-end",
      { immediate: true },
    );
    expect(ctx.state.pointerDragCleanup).toBeNull();
    expect(target.releasePointerCapture).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("cancels the previous session before binding another gesture", () => {
    const { actions, target, events, ctx } = fixture();
    const oldMove =
      vi.fn<Parameters<PointerDragActions["bindPointerDrag"]>[2]>();
    const oldEnd =
      vi.fn<Parameters<PointerDragActions["bindPointerDrag"]>[2]>();
    const nextMove =
      vi.fn<Parameters<PointerDragActions["bindPointerDrag"]>[2]>();
    actions.bindPointerDrag(1, target, oldMove, oldEnd);
    actions.bindPointerDrag(2, target, nextMove);
    events.dispatchEvent(new PointerSample("pointermove", 1));
    events.dispatchEvent(new PointerSample("pointermove", 2));
    expect(oldMove).not.toHaveBeenCalled();
    expect(oldEnd).toHaveBeenCalledOnce();
    expect(requiredEntry(oldEnd.mock.calls, 0)[0].type).toBe("pointercancel");
    expect(nextMove).toHaveBeenCalledOnce();
    expect(ctx.state.pointerDragCleanup).not.toBeNull();
  });

  it("ignores a late lost-capture event after the same pointer is captured by a new session", () => {
    const { actions, target, events } = fixture();
    const end = vi.fn<Parameters<PointerDragActions["bindPointerDrag"]>[2]>();
    actions.bindPointerDrag(
      1,
      target,
      vi.fn<Parameters<PointerDragActions["bindPointerDrag"]>[2]>(),
    );
    actions.bindPointerDrag(
      1,
      target,
      vi.fn<Parameters<PointerDragActions["bindPointerDrag"]>[2]>(),
      end,
    );
    target.dispatchEvent(new PointerSample("lostpointercapture", 1));
    const move = new PointerSample("pointermove", 1);
    events.dispatchEvent(move);
    expect(end).not.toHaveBeenCalled();
    events.dispatchEvent(new PointerSample("pointerup", 1));
    expect(end).toHaveBeenCalledOnce();
  });

  it("keeps window fallback listeners when capture fails", () => {
    const { actions, target, events } = fixture();
    target.captureError = new Error("capture unavailable");
    const move = vi.fn<Parameters<PointerDragActions["bindPointerDrag"]>[2]>();
    const end = vi.fn<Parameters<PointerDragActions["bindPointerDrag"]>[2]>();
    actions.bindPointerDrag(1, target, move, end);
    events.dispatchEvent(new PointerSample("pointermove", 1));
    events.dispatchEvent(new PointerSample("pointerup", 1));
    expect(move).toHaveBeenCalledOnce();
    expect(end).toHaveBeenCalledOnce();
    expect(target.releasePointerCapture).not.toHaveBeenCalled();
  });

  it("cancels once on window blur and removes listeners", () => {
    const { actions, target, events, ctx } = fixture();
    const move = vi.fn<Parameters<PointerDragActions["bindPointerDrag"]>[2]>();
    const end = vi.fn<Parameters<PointerDragActions["bindPointerDrag"]>[2]>();
    actions.bindPointerDrag(1, target, move, end);
    events.dispatchEvent(new Event("blur"));
    events.dispatchEvent(new PointerSample("pointerup", 1));
    events.dispatchEvent(new PointerSample("pointermove", 1));
    expect(move).not.toHaveBeenCalled();
    expect(end).toHaveBeenCalledOnce();
    expect(requiredEntry(end.mock.calls, 0)[0].type).toBe("pointercancel");
    expect(ctx.state.pointerDragCleanup).toBeNull();
  });

  it("continues through capture loss when a rerender replaces the target", () => {
    const { actions, target, events } = fixture();
    const move = vi.fn<Parameters<PointerDragActions["bindPointerDrag"]>[2]>();
    const end = vi.fn<Parameters<PointerDragActions["bindPointerDrag"]>[2]>();
    actions.bindPointerDrag(1, target, move, end);
    target.captures.delete(1);
    target.dispatchEvent(new PointerSample("lostpointercapture", 1));
    events.dispatchEvent(new PointerSample("pointermove", 1));
    expect(move).toHaveBeenCalledOnce();
    expect(end).not.toHaveBeenCalled();
    events.dispatchEvent(new PointerSample("pointerup", 1));
    expect(end).toHaveBeenCalledOnce();
  });

  it("supports the mouse fallback without accepting pointer events", () => {
    const { actions, target, events } = fixture();
    const move = vi.fn<Parameters<PointerDragActions["bindPointerDrag"]>[2]>();
    const end = vi.fn<Parameters<PointerDragActions["bindPointerDrag"]>[2]>();
    actions.bindPointerDrag(undefined, target, move, end);
    events.dispatchEvent(new PointerSample("pointermove", 1));
    expect(move).not.toHaveBeenCalled();
    events.dispatchEvent(new MouseSample("mousemove"));
    events.dispatchEvent(new MouseSample("mouseup"));
    events.dispatchEvent(new MouseSample("mousemove"));
    expect(move).toHaveBeenCalledOnce();
    expect(end).toHaveBeenCalledOnce();
  });

  it("does not mark a replacement source dirty when the old gesture finishes", () => {
    const { actions, target, events, ctx, setFingerprint } = fixture();
    actions.bindPointerDrag(1, target, () => {
      ctx.state.dragMoved = true;
    });
    events.dispatchEvent(new PointerSample("pointermove", 1));
    ctx.state.currentTemplate = { id: "replacement", duration: 4 };
    setFingerprint("replacement bytes");
    events.dispatchEvent(new PointerSample("pointerup", 1));
    expect(ctx.markEditorChanged).not.toHaveBeenCalled();
    expect(ctx.state.dragSuppressClickTarget).toBeNull();
  });

  it("cleans up before a failing end callback and remains idempotent", () => {
    const { actions, target, ctx } = fixture();
    actions.bindPointerDrag(
      1,
      target,
      vi.fn<Parameters<PointerDragActions["bindPointerDrag"]>[2]>(),
      () => {
        throw new Error("end failed");
      },
    );
    const cancel = ctx.state.pointerDragCleanup;
    expect(() => cancel?.()).toThrow("end failed");
    expect(ctx.state.pointerDragCleanup).toBeNull();
    expect(target.releasePointerCapture).toHaveBeenCalledOnce();
    cancel?.();
    expect(target.releasePointerCapture).toHaveBeenCalledOnce();
  });

  it("rejects invalid targets and pointer ids without canceling a valid gesture", () => {
    const { actions, target, ctx } = fixture();
    actions.bindPointerDrag(
      1,
      target,
      vi.fn<Parameters<PointerDragActions["bindPointerDrag"]>[2]>(),
    );
    const cancel = ctx.state.pointerDragCleanup;
    actions.bindPointerDrag(
      2,
      null,
      vi.fn<Parameters<PointerDragActions["bindPointerDrag"]>[2]>(),
    );
    actions.bindPointerDrag(
      Number.NaN,
      target,
      vi.fn<Parameters<PointerDragActions["bindPointerDrag"]>[2]>(),
    );
    expect(ctx.state.pointerDragCleanup).toBe(cancel);
  });
});

describe("viewer pointer drag click suppression", () => {
  it("suppresses one generated click only on the dragged target", () => {
    const { actions, target, ctx } = fixture();
    ctx.state.dragSuppressClickTarget = target;
    ctx.state.dragSuppressClickUntil = performance.now() + 1000;
    expect(
      actions.shouldSuppressDragClick({ currentTarget: new Target() }),
    ).toBe(false);
    expect(actions.shouldSuppressDragClick({ currentTarget: target })).toBe(
      true,
    );
    expect(actions.shouldSuppressDragClick({ currentTarget: target })).toBe(
      false,
    );
  });

  it("matches a replacement DOM node without confusing delimiter-colliding identities", () => {
    const { actions, target, events, ctx } = fixture();
    target.attributes.set("data-track-id", "a:b");
    target.attributes.set("data-keyframe-id", "c");
    actions.bindPointerDrag(1, target, () => {
      ctx.state.dragMoved = true;
    });
    events.dispatchEvent(new PointerSample("pointermove", 1));
    events.dispatchEvent(new PointerSample("pointerup", 1));
    const other = new Target();
    other.attributes.set("data-track-id", "a");
    other.attributes.set("data-keyframe-id", "b:c");
    expect(actions.shouldSuppressDragClick({ target: other })).toBe(false);
    const replacement = new Target();
    replacement.attributes.set("data-track-id", "a:b");
    replacement.attributes.set("data-keyframe-id", "c");
    expect(actions.shouldSuppressDragClick({ target: replacement })).toBe(true);
    expect(actions.shouldSuppressDragClick({ target: replacement })).toBe(
      false,
    );
  });

  it("expires suppression and rejects malformed event payloads", () => {
    const { actions, target, ctx } = fixture();
    ctx.state.dragSuppressClickTarget = target;
    ctx.state.dragSuppressClickUntil = performance.now() + 1000;
    for (const value of [null, undefined, true, "click", []])
      expect(actions.shouldSuppressDragClick(value)).toBe(false);
    ctx.state.dragSuppressClickUntil = 0;
    expect(actions.shouldSuppressDragClick({ target })).toBe(false);
    expect(ctx.state.dragSuppressClickTarget).toBeNull();
  });
});

class Target extends EventTarget {
  tagName = "BUTTON";
  id = "";
  attributes = new Map<string, string>();
  captures = new Set<number>();
  captureError: Error | null = null;
  classList = { contains: (name: string) => name === "keyframe-point" };
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
  setPointerCapture = vi.fn<(id: number) => void>((id: number): void => {
    if (this.captureError) throw this.captureError;
    this.captures.add(id);
  });
  hasPointerCapture(id: number): boolean {
    return this.captures.has(id);
  }
  releasePointerCapture = vi.fn<(id: number) => void>((id: number): void => {
    this.captures.delete(id);
  });
}
class MouseSample extends Event {
  clientX = 10;
  clientY = 20;
}
class PointerSample extends MouseSample {
  constructor(
    type: string,
    readonly pointerId: number,
  ) {
    super(type);
  }
}
function fixture() {
  const events = new EventTarget();
  vi.stubGlobal("window", events);
  vi.stubGlobal("Element", Target);
  vi.stubGlobal("MouseEvent", MouseSample);
  const state = createViewerState();
  state.currentTemplate = { id: "source", duration: 4 };
  let fingerprint = "original";
  const ctx = {
    state,
    getEditorContentFingerprint: () => fingerprint,
    markEditorChanged:
      vi.fn<NonNullable<PointerDragContext["markEditorChanged"]>>(),
  };
  const actions = createPointerDragActions(() => ctx);
  cleanups.push(() => ctx.state.pointerDragCleanup?.());
  return {
    actions,
    ctx,
    events,
    target: new Target(),
    setFingerprint: (next: string) => {
      fingerprint = next;
    },
  };
}
