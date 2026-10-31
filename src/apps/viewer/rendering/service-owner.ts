import { bindViewerAction } from "../app/bind-action.js";
import type { ViewerAppContext } from "../app/context.js";
import type { RenderServiceActions } from "./model-contract.js";
import { markRendererBinding } from "./renderer-binding-status.js";
import { resolveRenderIdleWaiters, waitForRenderIdle } from "./render-queue.js";
import { renderCurrentFrame } from "./service.js";

export function createRenderServiceActions(
  getContext: () => ViewerAppContext,
): RenderServiceActions {
  return {
    renderCurrentFrame: bindViewerAction(renderCurrentFrame, getContext),
    waitForRenderIdle: bindViewerAction(waitForRenderIdle, getContext),
    resolveRenderIdleWaiters: bindViewerAction(
      resolveRenderIdleWaiters,
      getContext,
    ),
    markRendererBinding: bindViewerAction(markRendererBinding, getContext),
  };
}
