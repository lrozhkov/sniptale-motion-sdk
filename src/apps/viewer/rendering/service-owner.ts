import type { ViewerAppContext } from "../app/context.js";
import {
  isRendererBound,
  markRendererBinding,
} from "./renderer-binding-status.js";
import { resolveRenderIdleWaiters, waitForRenderIdle } from "./render-queue.js";
import { renderCurrentFrame } from "./service.js";

export function installRenderingServiceOwner(ctx: ViewerAppContext): void {
  ctx.renderCurrentFrame = (...args: any[]) =>
    (renderCurrentFrame as any)(ctx, ...args);
  ctx.waitForRenderIdle = (...args: any[]) =>
    (waitForRenderIdle as any)(ctx, ...args);
  ctx.resolveRenderIdleWaiters = (...args: any[]) =>
    (resolveRenderIdleWaiters as any)(ctx, ...args);
  ctx.markRendererBinding = (...args: any[]) =>
    (markRendererBinding as any)(ctx, ...args);
  ctx.isRendererBound = (...args: any[]) =>
    (isRendererBound as any)(ctx, ...args);
}
