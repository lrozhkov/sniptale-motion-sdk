import type { ViewerTransportState, SandboxRequest } from "./state.js";
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

type SandboxFrame = Pick<HTMLIFrameElement, "src"> & {
  contentWindow: Pick<Window, "postMessage"> | null;
};

export function postToSandboxWithTimeout(
  state: Pick<ViewerTransportState, "pending" | "directRenderResponsePort"> & {
    directRenderEffectIds?: ReadonlySet<string>;
  },
  sandboxFrame: SandboxFrame,
  message: SandboxRequest,
  timeoutMs: number,
  transfer: Transferable[] = [],
): Promise<unknown> {
  const requestId = message.requestId;
  const requestKind = message.kind;
  const requestTarget =
    typeof message.effectId === "string"
      ? message.effectId
      : typeof message.moduleId === "string"
        ? message.moduleId
        : "";
  return new Promise<unknown>((resolve, reject) => {
    if (state.pending.has(requestId)) {
      reject(new Error("Duplicate sandbox request id."));
      return;
    }
    const expire = () => {
      state.pending.delete(requestId);
      reject(
        new SandboxRequestTimeoutError(
          requestId,
          requestKind,
          timeoutMs,
          requestTarget,
        ),
      );
    };
    const timer = window.setTimeout(expire, timeoutMs);
    state.pending.set(requestId, {
      expire,
      reject,
      resolve,
      timeoutMs,
      timer,
    });
    const target = sandboxFrame.contentWindow;
    if (!target) {
      window.clearTimeout(timer);
      state.pending.delete(requestId);
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
      typeof message.effectId === "string" &&
      state.directRenderEffectIds?.has(message.effectId)
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
    try {
      const targetOrigin = new URL(sandboxFrame.src, window.location.href)
        .origin;
      target.postMessage(message, targetOrigin, transfer);
    } catch (error) {
      window.clearTimeout(timer);
      state.pending.delete(requestId);
      reject(error);
    }
  });
}

export function refreshPendingSandboxRequestTimeout(
  state: Pick<ViewerTransportState, "pending">,
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

export function cancelPendingSandboxRequests(
  state: Pick<ViewerTransportState, "pending">,
): number {
  const pending = Array.from(state.pending.values());
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

export function completePending(
  state: Pick<ViewerTransportState, "pending">,
  message: unknown,
): void {
  const requestId = readRequestId(message);
  if (requestId === null) return;
  const pending = state.pending.get(requestId);
  if (!pending) {
    return;
  }
  window.clearTimeout(pending.timer);
  state.pending.delete(requestId);
  pending.resolve(message);
}

export function completeRender(
  state: Pick<ViewerTransportState, "pending"> & { staleResponses: number },
  message: unknown,
): void {
  const requestId = readRequestId(message);
  if (requestId === null) return;
  const pending = state.pending.get(requestId);
  if (!pending) {
    state.staleResponses += 1;
    return;
  }
  window.clearTimeout(pending.timer);
  state.pending.delete(requestId);
  pending.resolve(message);
}

function readRequestId(value: unknown): string | null {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !("requestId" in value)
  )
    return null;
  const requestId = value.requestId;
  return typeof requestId === "string" ? requestId : null;
}
