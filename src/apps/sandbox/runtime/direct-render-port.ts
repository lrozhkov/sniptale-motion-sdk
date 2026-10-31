import type { SandboxRuntimeMessage } from "./message-boundary.js";

type MessageSink = (message: unknown, transfer?: Transferable[]) => void;

export type DirectPresentationSurface = OffscreenCanvas;

export type DirectRenderPortConnection = {
  kind: "connectDirectRenderPort";
  port: MessagePort;
  presentationSurface?: DirectPresentationSurface;
};

export function parseDirectRenderPortConnection(
  value: unknown,
): DirectRenderPortConnection | null {
  if (!isRecord(value) || value.kind !== "connectDirectRenderPort") {
    return null;
  }
  const port = value.port;
  if (!isNativeMessagePort(port)) return null;
  const presentationSurface = value.presentationSurface;
  if (
    presentationSurface !== undefined &&
    (!isOffscreenSurface(presentationSurface) ||
      !isPositiveFiniteNumber(presentationSurface.width) ||
      !isPositiveFiniteNumber(presentationSurface.height))
  ) {
    return null;
  }
  return {
    kind: "connectDirectRenderPort",
    port,
    ...(isOffscreenSurface(presentationSurface) ? { presentationSurface } : {}),
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
  let directPort: MessagePort | null = null;
  return (event: MessageEvent<unknown>) => {
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
  getPort: () => MessagePort | null,
  setPort: (port: MessagePort | null) => void,
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
        ("kind" in response ? response.kind : undefined) !==
          "renderFrameProgress"
      ) {
        fallbackPost({ kind: "directRenderSettled", requestId });
      }
    } catch {
      setPort(null);
      fallbackPost(response, transfer);
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isNativeMessagePort(value: unknown): value is MessagePort {
  return typeof MessagePort !== "undefined" && value instanceof MessagePort;
}

function isOffscreenSurface(value: unknown): value is OffscreenCanvas {
  return (
    typeof OffscreenCanvas !== "undefined" && value instanceof OffscreenCanvas
  );
}
