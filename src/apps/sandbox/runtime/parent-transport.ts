export function resolveSandboxParentOrigin(referrer: string): string | null {
  if (!referrer) {
    return null;
  }
  try {
    const url = new URL(referrer);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

export function createSandboxParentTransport(
  parentWindow: Window,
  referrer: string,
) {
  const parentOrigin = resolveSandboxParentOrigin(referrer);
  return {
    accepts(event: MessageEvent) {
      return (
        event.source === parentWindow &&
        (!parentOrigin || event.origin === parentOrigin)
      );
    },
    post(message: unknown, transfer: Transferable[] = []) {
      parentWindow.postMessage(message, parentOrigin ?? "*", transfer);
    },
  };
}
