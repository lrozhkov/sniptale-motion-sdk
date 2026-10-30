import type { ViewerAppContext } from "../app/context.js";
import { parseViewerSandboxMessage } from "./message-boundary.js";
import {
  connectDirectRenderResponseChannel,
  prepareDirectPresentationCanvas,
} from "./direct-render-channel.js";
import { shouldReportSandboxRequestFailure } from "./sandbox-client.js";

function handleSandboxMessage(ctx: ViewerAppContext, value: unknown) {
  const message = parseViewerSandboxMessage(value);
  if (!message) {
    return;
  }
  if (message.kind === "runtimeReady") {
    ctx.markSandboxRuntimeReady();
    void ctx.invalidatePlaybackVideoCache?.();
    ctx.state.directRenderResponsePort?.close?.();
    if (ctx.refs.directPreviewCanvas) {
      ctx.refs.directPreviewCanvas = prepareDirectPresentationCanvas(
        ctx.refs.directPreviewCanvas,
        ctx.refs.canvas.width,
        ctx.refs.canvas.height,
      );
    }
    ctx.state.directRenderResponsePort = connectDirectRenderResponseChannel({
      onMessage: (directValue) => handleSandboxMessage(ctx, directValue),
      presentationCanvas: ctx.refs.directPreviewCanvas,
      sandboxFrame: ctx.refs.sandboxFrame,
    });
    ctx.state.directRenderEffectIds.clear();
    ctx.state.directLiveProfileCompleteKeys.clear();
    ctx.state.directLiveProfileSamples.clear();
    ctx.state.directLiveRenderKeys.clear();
    ctx.state.loadedModules.clear();
    ctx.state.effectIds.clear();
    ctx.state.compositionIds.clear();
    ctx.resetRenderAssetCache();
    ctx.resetRenderModelCache();
    ctx.state.sandboxReady = true;
    ctx.logDiagnostic("Sandbox runtime ready.", "ok");
    if (ctx.state.currentTemplate) {
      void restoreCurrentTemplateAfterSandboxRestart(ctx);
    } else {
      void ctx.selectInitialTemplateWhenReady();
    }
    return;
  }
  if (message.kind === "loadEffectDocumentResult") {
    ctx.deps.completePending(ctx.state, message);
    if (message.ok) {
      ctx.state.loadedModules.add(message.moduleId);
      for (const id of message.effectIds ?? []) {
        ctx.state.effectIds.add(id);
      }
      for (const id of message.compositionIds ?? []) {
        ctx.state.compositionIds.add(id);
      }
      if (message.executionMode === "worker") {
        for (const id of [
          ...(message.effectIds ?? []),
          ...(message.compositionIds ?? []),
        ]) {
          ctx.state.directRenderEffectIds.add(id);
        }
      }
    }
    return;
  }
  if (message.kind === "validateEffectDocumentResult") {
    ctx.deps.completePending(ctx.state, message);
    return;
  }
  if (message.kind === "renderFrameProgress") {
    ctx.deps.refreshPendingSandboxRequestTimeout(ctx.state, message.requestId);
    return;
  }
  if (message.kind === "renderFrameResult") {
    ctx.deps.completeRender(ctx.state, message);
  }
}

async function restoreCurrentTemplateAfterSandboxRestart(
  ctx: ViewerAppContext,
) {
  const template = ctx.state.currentTemplate;
  if (!template) {
    return;
  }
  if (!(await ctx.ensureModuleLoaded(template.moduleId))) {
    return;
  }
  ctx.syncPlaybackButtons();
  if (ctx.state.currentTemplate?.id === template.id) {
    await ctx.renderCurrentFrame({ allowColdStart: true, interactive: true });
  }
}
async function ensureModuleLoaded(ctx: ViewerAppContext, moduleId) {
  if (ctx.state.loadedModules.has(moduleId)) {
    return true;
  }
  const module = ctx.state.modules.get(moduleId);
  if (!module) {
    ctx.logDiagnostic(`Unknown module ${moduleId}.`, "error");
    return false;
  }
  if (!module.document) {
    ctx.logDiagnostic(
      `${moduleId}: only declarative Effect v1 documents are supported.`,
      "error",
    );
    return false;
  }
  const message = {
    document: module.document,
    kind: "loadEffectDocument",
    moduleId,
    requestId: ctx.deps.createRequestId("load"),
  };
  let result;
  try {
    result = await ctx.requestSandbox(
      message,
      ctx.deps.DEFAULT_LOAD_TIMEOUT_MS,
    );
  } catch (error) {
    if (shouldReportSandboxRequestFailure(error)) {
      ctx.logDiagnostic(
        `${moduleId}: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    }
    return false;
  }
  if (!result.ok) {
    const message =
      result.errorCode === "BACKGROUND_RENDERER_STOPPED"
        ? ctx.deps.t(
            "viewer.rendering.backgroundStopped",
            "Background renderer stopped. Switching to compatibility mode.",
          )
        : (result.error ??
          ctx.deps
            .t(
              "viewer.rendering.moduleLoadFailed",
              "Failed to load module {module}.",
            )
            .replace("{module}", moduleId));
    ctx.logDiagnostic(message, "error");
  } else {
    const effectCount = result.effectIds?.length ?? 0;
    const compositionCount = result.compositionIds?.length ?? 0;
    ctx.logDiagnostic(
      `Loaded module ${moduleId} (${effectCount} effects, ${compositionCount} compositions).`,
      "ok",
    );
  }
  return result.ok;
}
function createUniqueModuleId(ctx: ViewerAppContext, baseId) {
  const safeBase = ctx.sanitizeIdentifier(baseId || "imported-module");
  let candidate = `${safeBase}-import`;
  let suffix = 2;
  while (ctx.state.modules.has(candidate)) {
    candidate = `${safeBase}-import-${suffix}`;
    suffix += 1;
  }
  return candidate;
}
function createSandboxUrl(ctx: ViewerAppContext) {
  const params = new URLSearchParams(window.location.search);
  const port = resolveSandboxPort(
    params.get("sandboxPort"),
    ctx.refs.sandboxFrame.dataset.sandboxPort,
  );
  const host = resolveSandboxHost(window.location.hostname);
  return `${window.location.protocol}//${host}:${port}/sandbox.html`;
}

export function resolveSandboxHost(viewerHostname: string): string {
  if (viewerHostname === "127.0.0.1") {
    return "localhost";
  }
  if (viewerHostname === "localhost") {
    return "127.0.0.1";
  }
  return viewerHostname;
}

export function resolveSandboxPort(
  requestedPort: string | null,
  fallbackPort = "4178",
): string {
  const normalize = (value: string | null | undefined) => {
    if (!value || !/^\d{1,5}$/.test(value)) {
      return null;
    }
    const port = Number(value);
    return Number.isInteger(port) && port >= 1 && port <= 65535
      ? String(port)
      : null;
  };
  return normalize(requestedPort) ?? normalize(fallbackPort) ?? "4178";
}

export function installTransportControllerOwner(ctx: ViewerAppContext): void {
  ctx.handleSandboxMessage = handleSandboxMessage.bind(undefined, ctx);
  ctx.ensureModuleLoaded = ensureModuleLoaded.bind(undefined, ctx);
  ctx.createUniqueModuleId = createUniqueModuleId.bind(undefined, ctx);
  ctx.createSandboxUrl = createSandboxUrl.bind(undefined, ctx);
}
