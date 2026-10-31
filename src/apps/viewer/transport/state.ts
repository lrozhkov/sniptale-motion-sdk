import type { DirectRenderResponsePort } from "./direct-render-channel.js";

export type SandboxRequest = Record<string, unknown> & {
  kind: string;
  requestId: string;
};
export type PendingSandboxRequest = {
  expire: () => void;
  reject: (error: unknown) => void;
  resolve: (value: unknown) => void;
  timeoutMs: number;
  timer: number;
};

export type ViewerTransportState = {
  directRenderResponsePort: DirectRenderResponsePort | null;
  pending: Map<string, PendingSandboxRequest>;
  sandboxRecoveryKey: string | null;
};

export function createViewerTransportState(): ViewerTransportState {
  return {
    directRenderResponsePort: null,
    pending: new Map(),
    sandboxRecoveryKey: null,
  };
}
