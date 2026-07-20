export class SandboxRequestTimeoutError extends Error {
  recoveryStarted = false;

  constructor(
    readonly requestId: string,
    readonly requestKind: string,
    readonly timeoutMs: number,
    readonly requestTarget = "",
  ) {
    super(
      `${requestKind}${requestTarget ? ` for ${requestTarget}` : ""} (${requestId}) timed out after ${timeoutMs}ms.`,
    );
    this.name = "SandboxRequestTimeoutError";
  }
}

export class SandboxRuntimeRecoveryError extends Error {
  constructor() {
    super("Sandbox runtime restarted after an unresponsive render.");
    this.name = "SandboxRuntimeRecoveryError";
  }
}

export function postToSandboxWithTimeout(
  state: any,
  sandboxFrame: HTMLIFrameElement,
  message: any,
  timeoutMs: number,
  transfer: Transferable[] = [],
): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    const expire = () => {
      state.pending.delete(message.requestId);
      reject(
        new SandboxRequestTimeoutError(
          message.requestId,
          String(message.kind ?? "unknown"),
          timeoutMs,
          String(message.effectId ?? message.moduleId ?? ""),
        ),
      );
    };
    const timer = window.setTimeout(expire, timeoutMs);
    state.pending.set(message.requestId, {
      expire,
      reject,
      resolve,
      timeoutMs,
      timer,
    });
    const target = sandboxFrame.contentWindow;
    if (!target) {
      window.clearTimeout(timer);
      state.pending.delete(message.requestId);
      reject(new Error("Sandbox frame is not available."));
      return;
    }
    const directPort =
      message.kind === "renderFrame" &&
      message.bindingReadMode !== "contract" &&
      // Cache preparation must enter through the iframe. The iframe owns an
      // independent heartbeat and can keep an older 900 ms viewer alive even
      // while the render worker or GPU driver is busy. Results still return on
      // the direct port, so large bitmaps do not take the iframe hop.
      message.previewCacheEnabled !== true &&
      state.directRenderEffectIds?.has?.(message.effectId)
        ? state.directRenderResponsePort
        : null;
    if (directPort) {
      try {
        directPort.postMessage(message, transfer);
        return;
      } catch {
        // The iframe path remains the compatibility fallback if a transferred
        // port was closed during a sandbox restart.
      }
    }
    const targetOrigin = new URL(sandboxFrame.src, window.location.href).origin;
    target.postMessage(message, targetOrigin, transfer);
  });
}

export function refreshPendingSandboxRequestTimeout(
  state: any,
  requestId: string,
): boolean {
  const pending = state.pending.get(requestId);
  if (
    !pending ||
    typeof pending.expire !== "function" ||
    !Number.isFinite(pending.timeoutMs) ||
    pending.timeoutMs <= 0
  ) {
    return false;
  }
  window.clearTimeout(pending.timer);
  pending.timer = window.setTimeout(pending.expire, pending.timeoutMs);
  return true;
}

export function cancelPendingSandboxRequests(state: any): number {
  const pending = Array.from(state.pending.values()) as Array<{
    reject?: (error: Error) => void;
    timer: number;
  }>;
  state.pending.clear();
  for (const request of pending) {
    window.clearTimeout(request.timer);
    request.reject?.(new SandboxRuntimeRecoveryError());
  }
  return pending.length;
}

export function isSandboxRequestTimeoutError(
  error: unknown,
): error is SandboxRequestTimeoutError {
  return error instanceof SandboxRequestTimeoutError;
}

export function isSandboxRuntimeRecoveryError(
  error: unknown,
): error is SandboxRuntimeRecoveryError {
  return error instanceof SandboxRuntimeRecoveryError;
}

export function shouldReportSandboxRequestFailure(error: unknown): boolean {
  return (
    !isSandboxRuntimeRecoveryError(error) &&
    !(isSandboxRequestTimeoutError(error) && error.recoveryStarted)
  );
}

export function completePending(state: any, message: any) {
  const pending = state.pending.get(message.requestId);
  if (!pending) {
    return;
  }
  window.clearTimeout(pending.timer);
  state.pending.delete(message.requestId);
  pending.resolve(message);
}

export function completeRender(state: any, message: any) {
  const pending = state.pending.get(message.requestId);
  if (!pending) {
    state.staleResponses += 1;
    return;
  }
  window.clearTimeout(pending.timer);
  state.pending.delete(message.requestId);
  pending.resolve(message);
}
