import type { SandboxRenderContext } from "./render-context.js";

export type SandboxRenderer = {
  id: string;
  kind?: string;
  meta?: unknown;
  scenes?: unknown;
  renderFrame(context: SandboxRenderContext): Promise<unknown>;
  dispose?(): void;
};
