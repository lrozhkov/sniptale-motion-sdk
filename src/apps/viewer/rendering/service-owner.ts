import type { ViewerAppContext } from "../app/context.js";
import {
  isRendererBound,
  markRendererBinding,
} from "./renderer-binding-status.js";
import { resolveRenderIdleWaiters, waitForRenderIdle } from "./render-queue.js";
import { renderCurrentFrame } from "./service.js";

export function installRenderingServiceOwner(ctx: ViewerAppContext): void {
  ctx.renderCurrentFrame = renderCurrentFrame.bind(undefined, ctx);
  ctx.waitForRenderIdle = waitForRenderIdle.bind(undefined, ctx);
  ctx.resolveRenderIdleWaiters = resolveRenderIdleWaiters.bind(undefined, ctx);
  ctx.markRendererBinding = markRendererBinding.bind(undefined, ctx);
  ctx.isRendererBound = isRendererBound.bind(undefined, ctx);
}
