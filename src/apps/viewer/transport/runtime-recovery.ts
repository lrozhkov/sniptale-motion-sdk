import { bindViewerAction } from "../app/bind-action.js";
import type {
  TransportRuntimeActions,
  SandboxResponse,
  SandboxRenderResponse,
  SandboxLoadResponse,
  SandboxValidationResponse,
} from "./contract.js";
import {
  parseViewerSandboxMessage,
  discardSandboxMessageBitmap,
} from "./message-boundary.js";
import type { SandboxRequest } from "./state.js";
import type { ViewerAppContext } from "../app/context.js";
import {
  cancelPendingSandboxRequests,
  isSandboxRequestTimeoutError,
} from "./sandbox-client.js";

const MAX_CONSECUTIVE_RECOVERIES = 1;

async function sendSandboxRequest(
  ctx: ViewerAppContext,
  message: SandboxRequest,
  timeoutMs: number,
  transfer: Transferable[] = [],
): Promise<SandboxResponse> {
  try {
    const value: unknown = await ctx.deps.postToSandboxWithTimeout(
      ctx.state,
      ctx.refs.sandboxFrame,
      message,
      timeoutMs,
      transfer,
    );
    const response = parseViewerSandboxMessage(value);
    if (
      !response ||
      !("requestId" in response) ||
      response.kind === "renderFrameProgress" ||
      response.requestId !== message.requestId ||
      response.kind !== `${message.kind}Result`
    ) {
      discardSandboxMessageBitmap(value);
      throw new Error("Invalid sandbox response for request.");
    }
    return response;
  } catch (error) {
    if (
      isSandboxRequestTimeoutError(error) &&
      recoverSandboxRuntime(ctx, message)
    ) {
      error.recoveryStarted = true;
    }
    throw error;
  }
}

export function recoverSandboxRuntime(
  ctx: ViewerAppContext,
  request: Record<string, unknown>,
): boolean {
  const recoveryKey =
    ctx.state.currentTemplate?.id ??
    (typeof request.effectId === "string"
      ? request.effectId
      : typeof request.moduleId === "string"
        ? request.moduleId
        : "runtime");
  if (ctx.state.sandboxRecoveryKey !== recoveryKey) {
    ctx.state.sandboxRecoveryKey = recoveryKey;
    ctx.state.sandboxRecoveryAttempts = 0;
  }
  if (
    ctx.state.sandboxRecoveryPending ||
    ctx.state.sandboxRecoveryAttempts >= MAX_CONSECUTIVE_RECOVERIES
  ) {
    return false;
  }
  ctx.state.sandboxRecoveryAttempts += 1;
  ctx.state.sandboxRecoveryPending = true;
  ctx.state.sandboxRuntimeGeneration += 1;
  ctx.state.sandboxReady = false;
  ctx.state.renderQueued = false;
  ctx.state.queuedRenderOptions = null;
  ctx.stopPlaybackForRuntimeRecovery?.();
  ctx.state.directRenderResponsePort?.close?.();
  ctx.state.directRenderResponsePort = null;
  cancelPendingSandboxRequests(ctx.state);
  ctx.logDiagnostic(
    `${recoveryKey}: ${ctx.deps.t(
      "viewer.rendering.restartingAfterTimeout",
      "Preview renderer did not respond and is restarting.",
    )}`,
    "error",
  );
  const url = new URL(ctx.createSandboxUrl(), window.location.href);
  url.searchParams.set("runtimeRestart", `${Date.now()}`);
  ctx.refs.sandboxFrame.src = url.toString();
  return true;
}

function markSandboxRuntimeReady(ctx: ViewerAppContext): void {
  if (ctx.state.sandboxReady) {
    ctx.state.sandboxRuntimeGeneration += 1;
  }
  ctx.state.sandboxRecoveryPending = false;
}

function markSandboxRenderHealthy(
  ctx: ViewerAppContext,
  templateId: string,
): void {
  if (ctx.state.sandboxRecoveryKey !== templateId) {
    return;
  }
  ctx.state.sandboxRecoveryAttempts = 0;
  ctx.state.sandboxRecoveryPending = false;
}

export function createTransportRuntimeActions(
  getContext: () => ViewerAppContext,
): TransportRuntimeActions {
  function requestSandbox(
    message: SandboxRequest & { kind: "renderFrame" },
    timeoutMs: number,
    transfer?: Transferable[],
  ): Promise<SandboxRenderResponse>;
  function requestSandbox(
    message: SandboxRequest & { kind: "loadEffectDocument" },
    timeoutMs: number,
    transfer?: Transferable[],
  ): Promise<SandboxLoadResponse>;
  function requestSandbox(
    message: SandboxRequest & { kind: "validateEffectDocument" },
    timeoutMs: number,
    transfer?: Transferable[],
  ): Promise<SandboxValidationResponse>;
  function requestSandbox(
    message: SandboxRequest,
    timeoutMs: number,
    transfer?: Transferable[],
  ): Promise<SandboxResponse>;
  function requestSandbox(
    message: SandboxRequest,
    timeoutMs: number,
    transfer: Transferable[] = [],
  ): Promise<SandboxResponse> {
    return sendSandboxRequest(getContext(), message, timeoutMs, transfer);
  }
  return {
    requestSandbox,
    markSandboxRuntimeReady: bindViewerAction(
      markSandboxRuntimeReady,
      getContext,
    ),
    markSandboxRenderHealthy: bindViewerAction(
      markSandboxRenderHealthy,
      getContext,
    ),
  };
}
