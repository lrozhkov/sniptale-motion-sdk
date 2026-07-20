import type { ViewerAppContext } from "../app/context.js";

export function mergeQueuedRenderOptions(current, next) {
  if (current?.forceFull || next?.forceFull) {
    return { forceFull: true };
  }
  return {
    allowColdStart: Boolean(current?.allowColdStart || next?.allowColdStart),
    interactive: Boolean(current?.interactive || next?.interactive),
  };
}

export function waitForRenderIdle(ctx: ViewerAppContext) {
  if (!ctx.state.renderInFlight && !ctx.state.renderQueued) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    ctx.state.renderIdleWaiters.push(resolve);
  });
}

export function resolveRenderIdleWaiters(ctx: ViewerAppContext) {
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
