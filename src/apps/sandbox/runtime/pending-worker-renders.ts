import { beginSandboxRenderProgress } from "./render-progress.js";

type WorkerRenderIdentity = {
  previewCacheEnabled?: boolean;
  requestId: string;
  sequenceId: number;
};

type PendingWorkerRender = WorkerRenderIdentity & {
  stopProgress: (() => void) | null;
};

type MessageSink = (message: unknown, transfer?: Transferable[]) => void;

export function createPendingWorkerRenderRegistry(post: MessageSink) {
  const renders = new Map<string, PendingWorkerRender>();

  function begin(message: WorkerRenderIdentity): void {
    settle(message.requestId);
    let stopProgress: (() => void) | null = null;
    if (message.previewCacheEnabled === true) {
      const progress = beginSandboxRenderProgress({
        previewCacheEnabled: true,
        post,
        requestId: message.requestId,
        sequenceId: message.sequenceId,
      });
      progress.setPhase("rendering");
      stopProgress = progress.stop;
    }
    renders.set(message.requestId, { ...message, stopProgress });
  }

  function settle(requestId: string): PendingWorkerRender | null {
    const render = renders.get(requestId) ?? null;
    if (!render) {
      return null;
    }
    renders.delete(requestId);
    render.stopProgress?.();
    return render;
  }

  function clear(): PendingWorkerRender[] {
    const pending = Array.from(renders.values());
    renders.clear();
    for (const render of pending) {
      render.stopProgress?.();
    }
    return pending;
  }

  return { begin, clear, settle };
}
