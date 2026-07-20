export type DirectRenderResponsePort = {
  close(): void;
  presentationSurfaceAttached: boolean;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

export function prepareDirectPresentationCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): HTMLCanvasElement {
  try {
    canvas.width = width;
    canvas.height = height;
    return canvas;
  } catch {
    const replacement = canvas.cloneNode(false) as HTMLCanvasElement;
    replacement.width = width;
    replacement.height = height;
    canvas.replaceWith(replacement);
    return replacement;
  }
}

export function connectDirectRenderResponseChannel({
  createChannel = () => new MessageChannel(),
  onMessage,
  presentationCanvas,
  sandboxFrame,
}: {
  createChannel?: () => MessageChannel;
  onMessage: (value: unknown) => void;
  presentationCanvas?: HTMLCanvasElement | null;
  sandboxFrame: HTMLIFrameElement;
}): DirectRenderResponsePort | null {
  const target = sandboxFrame.contentWindow;
  if (!target || typeof MessageChannel === "undefined") {
    return null;
  }
  const channel = createChannel();
  channel.port1.addEventListener("message", (event) => onMessage(event.data));
  channel.port1.start();
  const targetOrigin = new URL(sandboxFrame.src, window.location.href).origin;
  let presentationSurface: OffscreenCanvas | null = null;
  if (
    presentationCanvas &&
    typeof presentationCanvas.transferControlToOffscreen === "function"
  ) {
    try {
      presentationSurface = presentationCanvas.transferControlToOffscreen();
    } catch {
      presentationSurface = null;
    }
  }
  try {
    const transfer: Transferable[] = [channel.port2];
    if (presentationSurface) {
      transfer.push(presentationSurface);
    }
    target.postMessage(
      {
        kind: "connectDirectRenderPort",
        port: channel.port2,
        ...(presentationSurface ? { presentationSurface } : {}),
      },
      targetOrigin,
      transfer,
    );
    return {
      close: () => channel.port1.close(),
      postMessage: (message, transfer = []) =>
        channel.port1.postMessage(message, transfer),
      presentationSurfaceAttached: Boolean(presentationSurface),
    };
  } catch {
    channel.port1.close();
    channel.port2.close();
    return null;
  }
}
