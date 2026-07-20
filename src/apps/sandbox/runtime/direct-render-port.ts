import type { SandboxRuntimeMessage } from "./message-boundary.js";

type MessageSink = (message: unknown, transfer?: Transferable[]) => void;

type MessagePortLike = {
  addEventListener: (
    type: "message",
    listener: (event: MessageEvent) => void,
  ) => void;
  close?: () => void;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
  start?: () => void;
};

export type DirectPresentationSurface = {
  getContext(type: "2d" | "bitmaprenderer"): unknown;
  height: number;
  width: number;
};

export type DirectRenderPortConnection = {
  kind: "connectDirectRenderPort";
  port: MessagePortLike;
  presentationSurface?: DirectPresentationSurface;
};

export function parseDirectRenderPortConnection(
  value: unknown,
): DirectRenderPortConnection | null {
  if (!isRecord(value) || value.kind !== "connectDirectRenderPort") {
    return null;
  }
  const port = value.port;
  const validPort =
    isRecord(port) &&
    typeof port.postMessage === "function" &&
    typeof port.addEventListener === "function";
  if (!validPort) {
    return null;
  }
  const presentationSurface = value.presentationSurface;
  if (
    presentationSurface !== undefined &&
    (!isRecord(presentationSurface) ||
      typeof presentationSurface.getContext !== "function" ||
      !isPositiveFiniteNumber(presentationSurface.width) ||
      !isPositiveFiniteNumber(presentationSurface.height))
  ) {
    return null;
  }
  return {
    kind: "connectDirectRenderPort",
    port: port as MessagePortLike,
    ...(presentationSurface === undefined
      ? {}
      : {
          presentationSurface: presentationSurface as DirectPresentationSurface,
        }),
  };
}

export function createWorkerRuntimeMessageHandler({
  fallbackPost,
  onPresentationSurface,
  parseMessage,
  session,
}: {
  fallbackPost: MessageSink;
  onPresentationSurface?: (surface: DirectPresentationSurface) => void;
  parseMessage: (value: unknown) => SandboxRuntimeMessage | null;
  session: {
    handleMessage(
      message: SandboxRuntimeMessage,
      responseSink?: MessageSink,
    ): Promise<void>;
  };
}) {
  let directPort: MessagePortLike | null = null;
  return (event: MessageEvent) => {
    const connection = parseDirectRenderPortConnection(event.data);
    if (connection) {
      if (connection.presentationSurface) {
        onPresentationSurface?.(connection.presentationSurface);
      }
      directPort?.close?.();
      directPort = connection.port;
      directPort.addEventListener("message", (directEvent) => {
        const directMessage = parseMessage(directEvent.data);
        if (!directMessage || directMessage.kind !== "renderFrame") {
          return;
        }
        fallbackPost({
          kind: "directRenderStarted",
          previewCacheEnabled: directMessage.previewCacheEnabled === true,
          requestId: directMessage.requestId,
          sequenceId: directMessage.sequenceId,
        });
        void session.handleMessage(
          directMessage,
          createDirectResponseSink(
            directMessage.requestId,
            () => directPort,
            (nextPort) => {
              directPort = nextPort;
            },
            fallbackPost,
          ),
        );
      });
      directPort.start?.();
      return;
    }
    const message = parseMessage(event.data);
    if (!message) {
      return;
    }
    const directResponse =
      message.kind === "renderFrame" &&
      message.directResponse === true &&
      directPort;
    const responseSink = directResponse
      ? createDirectResponseSink(
          message.requestId,
          () => directPort,
          (nextPort) => {
            directPort = nextPort;
          },
          fallbackPost,
        )
      : fallbackPost;
    void session.handleMessage(message, responseSink);
  };
}

function createDirectResponseSink(
  requestId: string,
  getPort: () => MessagePortLike | null,
  setPort: (port: MessagePortLike | null) => void,
  fallbackPost: MessageSink,
): MessageSink {
  return (response: unknown, transfer: Transferable[] = []) => {
    try {
      const port = getPort();
      if (!port) {
        throw new Error("Direct render port is unavailable.");
      }
      port.postMessage(response, transfer);
      if (
        !response ||
        typeof response !== "object" ||
        (response as Record<string, unknown>).kind !== "renderFrameProgress"
      ) {
        fallbackPost({ kind: "directRenderSettled", requestId });
      }
    } catch {
      setPort(null);
      fallbackPost(response, transfer);
    }
  };
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
