import type { SandboxRuntimeMessage } from "./message-boundary.js";
import { createPendingWorkerRenderRegistry } from "./pending-worker-renders.js";
import { closeAssetBitmaps } from "./render-assets.js";
import { parseSandboxWorkerResponse } from "./worker-message-boundary.js";
import { serializeSvgVectorAsset } from "./svg-vector-parser.js";

type MessageSink = (message: unknown, transfer?: Transferable[]) => void;

type SandboxSession = {
  handleMessage(message: SandboxRuntimeMessage): Promise<void>;
};

type WorkerLike = {
  addEventListener(
    type: "error" | "message",
    listener: (event: any) => void,
  ): void;
  postMessage(message: unknown, transfer?: Transferable[]): void;
  terminate(): void;
};

type DirectRenderPortLike = Transferable & {
  close?: () => void;
};

type DirectPresentationSurfaceLike = Transferable;

export function createSandboxExecutionRouter({
  createForegroundSession,
  createWorker,
  postToParent,
}: {
  createForegroundSession: (post: MessageSink) => SandboxSession;
  createWorker: (() => WorkerLike) | null;
  postToParent: MessageSink;
}) {
  const workerEffectIds = new Set<string>();
  const pendingWorkerLoads = new Map<
    string,
    Extract<SandboxRuntimeMessage, { kind: "loadEffectDocument" }>
  >();
  const pendingWorkerRenders = createPendingWorkerRenderRegistry(postToParent);
  let renderWorker: WorkerLike | null = null;
  let directRenderPort: DirectRenderPortLike | null = null;
  let directPresentationSurface: DirectPresentationSurfaceLike | null = null;
  let directRenderPortAttached = false;
  let workerAvailable = Boolean(createWorker);
  const foregroundSession = createForegroundSession(postToParent);

  async function handleMessage(message: SandboxRuntimeMessage): Promise<void> {
    if (message.kind === "loadEffectDocument") {
      if (workerAvailable) {
        const worker = ensureWorker();
        if (worker) {
          pendingWorkerLoads.set(message.requestId, message);
          worker.postMessage(message);
          return;
        }
      }
      await foregroundSession.handleMessage(message);
      return;
    }
    if (
      message.kind === "renderFrame" &&
      workerEffectIds.has(message.effectId) &&
      ensureWorker()
    ) {
      dispatchWorkerRender(message);
      return;
    }
    if (message.kind === "dispose") {
      workerEffectIds.clear();
      pendingWorkerLoads.clear();
      pendingWorkerRenders.clear();
      renderWorker?.postMessage(message);
    }
    await foregroundSession.handleMessage(message);
  }

  function dispatchWorkerRender(
    message: Extract<SandboxRuntimeMessage, { kind: "renderFrame" }>,
  ): void {
    try {
      const preparedMessage = prepareWorkerRenderMessage(message);
      const workerMessage = directRenderPortAttached
        ? { ...preparedMessage, directResponse: true }
        : preparedMessage;
      pendingWorkerRenders.begin(message);
      renderWorker!.postMessage(
        workerMessage,
        collectRenderTransferables(workerMessage),
      );
    } catch {
      pendingWorkerRenders.settle(message.requestId);
      closeAssetBitmaps(message.assets);
      closeAssetBitmaps(message.inputFrames);
      postToParent({
        durationMs: 0,
        errorCode: "WORKER_RENDER_PREPARATION_FAILED",
        kind: "renderFrameResult",
        ok: false,
        requestId: message.requestId,
        sequenceId: message.sequenceId,
      });
    }
  }

  function ensureWorker(): WorkerLike | null {
    if (!workerAvailable || !createWorker) {
      return null;
    }
    if (renderWorker) {
      return renderWorker;
    }
    try {
      renderWorker = createWorker();
      renderWorker.addEventListener("message", handleWorkerMessage);
      renderWorker.addEventListener("error", handleWorkerError);
      attachDirectRenderPort();
      return renderWorker;
    } catch {
      workerAvailable = false;
      renderWorker = null;
      return null;
    }
  }

  function handleWorkerMessage(event: MessageEvent): void {
    const message = parseSandboxWorkerResponse(event.data);
    if (!message || message.kind === "workerReady") {
      return;
    }
    if (message.kind === "directRenderStarted") {
      pendingWorkerRenders.begin(message);
      return;
    }
    if (message.kind === "directRenderSettled") {
      pendingWorkerRenders.settle(message.requestId);
      return;
    }
    if (message.kind === "renderFrameProgress") {
      postToParent(message);
      return;
    }
    if (message.kind === "loadEffectDocumentResult") {
      pendingWorkerLoads.delete(message.requestId);
      if (message.ok) {
        for (const id of [...message.effectIds, ...message.compositionIds]) {
          workerEffectIds.add(id);
        }
      }
    } else {
      pendingWorkerRenders.settle(message.requestId);
    }
    const bitmap =
      message.kind === "renderFrameResult" && message.ok
        ? (message.bitmap as Transferable)
        : null;
    const response =
      message.kind === "loadEffectDocumentResult" && message.ok
        ? { ...message, executionMode: "worker" }
        : message;
    postToParent(response, bitmap ? [bitmap] : []);
  }

  function handleWorkerError(): void {
    const failedLoads = Array.from(pendingWorkerLoads.values());
    const failedRenders = pendingWorkerRenders.clear();
    const needsRuntimeRestart = workerEffectIds.size > 0;
    pendingWorkerLoads.clear();
    workerEffectIds.clear();
    renderWorker?.terminate();
    renderWorker = null;
    directRenderPort = null;
    directPresentationSurface = null;
    directRenderPortAttached = false;
    workerAvailable = false;
    for (const message of failedRenders) {
      postToParent({
        durationMs: 0,
        errorCode: "BACKGROUND_RENDERER_STOPPED",
        kind: "renderFrameResult",
        ok: false,
        requestId: message.requestId,
        sequenceId: message.sequenceId,
      });
    }
    if (needsRuntimeRestart) {
      for (const message of failedLoads) {
        postToParent({
          compositionIds: [],
          effectIds: [],
          errorCode: "BACKGROUND_RENDERER_STOPPED",
          kind: "loadEffectDocumentResult",
          moduleId: message.moduleId,
          ok: false,
          requestId: message.requestId,
        });
      }
      postToParent({ kind: "runtimeReady" });
    } else {
      for (const message of failedLoads) {
        void foregroundSession.handleMessage(message);
      }
    }
  }

  return {
    connectDirectRenderPort(
      port: DirectRenderPortLike,
      presentationSurface?: DirectPresentationSurfaceLike,
    ) {
      if (!port || typeof port !== "object") {
        return false;
      }
      if (directRenderPort && !directRenderPortAttached) {
        directRenderPort.close?.();
      }
      directRenderPort = port;
      directPresentationSurface = presentationSurface ?? null;
      directRenderPortAttached = false;
      attachDirectRenderPort();
      return true;
    },
    handleMessage,
    usingWorkerFor(effectId: string) {
      return workerEffectIds.has(effectId);
    },
  };

  function attachDirectRenderPort(): void {
    if (!renderWorker || !directRenderPort || directRenderPortAttached) {
      return;
    }
    const port = directRenderPort;
    const presentationSurface = directPresentationSurface;
    const transfer: Transferable[] = [port];
    if (presentationSurface) {
      transfer.push(presentationSurface);
    }
    renderWorker.postMessage(
      {
        kind: "connectDirectRenderPort",
        port,
        ...(presentationSurface ? { presentationSurface } : {}),
      },
      transfer,
    );
    directRenderPort = null;
    directPresentationSurface = null;
    directRenderPortAttached = true;
  }
}

export function prepareWorkerRenderMessage(message: Record<string, any>) {
  if (message.assets === undefined) {
    return { ...message };
  }
  const assets = Object.fromEntries(
    Object.entries(message.assets ?? {}).map(([id, asset]: [string, any]) => [
      id,
      asset?.svgText && !asset.svgVector
        ? { ...asset, svgVector: serializeSvgVectorAsset(asset) }
        : asset,
    ]),
  );
  return { ...message, assets };
}

export function collectRenderTransferables(
  message: Record<string, any>,
): Transferable[] {
  const values = [
    ...Object.values(message.assets ?? {}).map((asset: any) => asset?.bitmap),
    ...Object.values(message.inputFrames ?? {}).map(
      (frame: any) => frame?.bitmap ?? frame,
    ),
  ].filter(Boolean) as Transferable[];
  return Array.from(new Set(values));
}
