import type { RenderOptions } from "./state.js";
import type { ViewerAppContext } from "../app/context.js";

export function mergeQueuedRenderOptions(
  current: RenderOptions | null | undefined,
  next: RenderOptions | null | undefined,
): RenderOptions {
  if (current?.forceFull || next?.forceFull) {
    return { forceFull: true };
  }
  return {
    allowColdStart: Boolean(current?.allowColdStart || next?.allowColdStart),
    interactive: Boolean(current?.interactive || next?.interactive),
  };
}

export function waitForRenderIdle(
  ctx: Pick<ViewerAppContext, "state">,
): Promise<void> {
  if (!ctx.state.renderInFlight && !ctx.state.renderQueued) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    ctx.state.renderIdleWaiters.push(resolve);
  });
}

export function resolveRenderIdleWaiters(
  ctx: Pick<ViewerAppContext, "state">,
): void {
  if (
    ctx.state.renderInFlight ||
    ctx.state.renderQueued ||
    ctx.state.renderIdleWaiters.length === 0
  ) {
    return;
  }
  const waiters = ctx.state.renderIdleWaiters.splice(0);
  for (const resolve of waiters) {
    resolve();
  }
}
