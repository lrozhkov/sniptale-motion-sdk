import type { createSandboxRegistry } from "./registry.js";
import type { createSandboxRuntimeFacade } from "./runtime-facade.js";
import type { createDirectPreviewPresenter } from "./direct-presentation.js";
import type { FrameCanvasPool } from "./frame-canvas-pool.js";
import type { SandboxRuntimeMessage } from "./message-boundary.js";

export type SandboxSessionOptions = {
  postToParent: (message: unknown, transfer?: Transferable[]) => void;
  registry: ReturnType<typeof createSandboxRegistry>;
  runtime: ReturnType<typeof createSandboxRuntimeFacade>;
  previewPresenter?: ReturnType<typeof createDirectPreviewPresenter> | null;
};

export type SandboxDocumentSessionOptions = Pick<
  SandboxSessionOptions,
  "registry" | "runtime"
> & {
  canvasPool: FrameCanvasPool;
  message: SandboxRuntimeMessage;
  renderQueue: Promise<void>;
  responseSink: SandboxSessionOptions["postToParent"];
};
