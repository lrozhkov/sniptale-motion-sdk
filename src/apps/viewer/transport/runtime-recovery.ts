import type { ViewerAppContext } from "../app/context.js";
import {
  cancelPendingSandboxRequests,
  isSandboxRequestTimeoutError,
} from "./sandbox-client.js";

const MAX_CONSECUTIVE_RECOVERIES = 1;

async function requestSandbox(
  ctx: ViewerAppContext,
  message: Record<string, any>,
  timeoutMs: number,
  transfer: Transferable[] = [],
) {
  try {
    return await ctx.deps.postToSandboxWithTimeout(
      ctx.state,
      ctx.refs.sandboxFrame,
      message,
      timeoutMs,
      transfer,
    );
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
  request: Record<string, any>,
): boolean {
  const recoveryKey =
    ctx.state.currentTemplate?.id ??
    String(request.effectId ?? request.moduleId ?? "runtime");
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

export function installTransportRuntimeRecoveryOwner(
  ctx: ViewerAppContext,
): void {
  ctx.requestSandbox = requestSandbox.bind(undefined, ctx);
  ctx.markSandboxRuntimeReady = markSandboxRuntimeReady.bind(undefined, ctx);
  ctx.markSandboxRenderHealthy = markSandboxRenderHealthy.bind(undefined, ctx);
}
