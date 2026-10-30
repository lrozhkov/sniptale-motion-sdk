import type { BindingReads } from "./binding-reads.js";
import type { CanvasRenderQuality } from "./canvas-render-quality.js";
import type { SandboxRenderFrameMessage } from "./render-message-boundary.js";

export type RuntimeRenderState = {
  __bindingReads: BindingReads | null;
  __bindingReadMode: SandboxRenderFrameMessage["bindingReadMode"] | null;
  __renderQuality: CanvasRenderQuality;
  __renderViewport: { height: number; width: number } | null;
};
