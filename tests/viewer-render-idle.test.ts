import { describe, expect, it } from "vitest";
import { createViewerState } from "../src/apps/viewer/app/state.js";
import {
  resolveRenderIdleWaiters,
  waitForRenderIdle,
} from "../src/apps/viewer/rendering/render-queue.js";

describe("viewer render idle queue", () => {
  it("keeps callers waiting until the active frame and queued continuation both finish", async () => {
    const ctx = { state: createViewerState() };
    ctx.state.renderInFlight = true;
    let completed = false;
    const pending = waitForRenderIdle(ctx).then(() => {
      completed = true;
    });
    resolveRenderIdleWaiters(ctx);
    await Promise.resolve();
    expect(completed).toBe(false);
    ctx.state.renderInFlight = false;
    ctx.state.renderQueued = true;
    resolveRenderIdleWaiters(ctx);
    await Promise.resolve();
    expect(completed).toBe(false);
    ctx.state.renderQueued = false;
    resolveRenderIdleWaiters(ctx);
    await pending;
    expect(completed).toBe(true);
    expect(ctx.state.renderIdleWaiters).toEqual([]);
  });

  it("does not mix waiters from different viewer sessions", async () => {
    const first = { state: createViewerState() };
    const second = { state: createViewerState() };
    first.state.renderInFlight = true;
    let completed = false;
    const pending = waitForRenderIdle(first).then(() => {
      completed = true;
    });
    resolveRenderIdleWaiters(second);
    await Promise.resolve();
    expect(completed).toBe(false);
    first.state.renderInFlight = false;
    resolveRenderIdleWaiters(first);
    await pending;
    expect(completed).toBe(true);
  });
});
