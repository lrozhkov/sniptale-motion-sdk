import { readWorkerRuntimeScope } from "./runtime/worker-scope.js";
import { parseSandboxRuntimeMessage } from "./runtime/message-boundary.js";
import { createSandboxRegistry } from "./runtime/registry.js";
import { createSandboxRuntimeFacade } from "./runtime/runtime-facade.js";
import { createSandboxSession } from "./runtime/session.js";
import { createWorkerRuntimeMessageHandler } from "./runtime/direct-render-port.js";
import { createDirectPreviewPresenter } from "./runtime/direct-presentation.js";

const scope = readWorkerRuntimeScope(globalThis);
const registry = createSandboxRegistry();
const runtime = createSandboxRuntimeFacade(registry);
const previewPresenter = createDirectPreviewPresenter();
const session = createSandboxSession({
  postToParent(message: unknown, transfer: Transferable[] = []) {
    scope.postMessage(message, transfer);
  },
  registry,
  runtime,
  previewPresenter,
});
const handleRuntimeMessage = createWorkerRuntimeMessageHandler({
  fallbackPost(message: unknown, transfer: Transferable[] = []) {
    scope.postMessage(message, transfer);
  },
  onPresentationSurface(surface) {
    previewPresenter.connect(surface);
  },
  parseMessage: parseSandboxRuntimeMessage,
  session,
});

Object.defineProperty(globalThis, "SniptaleSandboxRuntime", {
  configurable: false,
  enumerable: false,
  value: runtime,
  writable: false,
});

scope.addEventListener("message", (event: MessageEvent<unknown>) => {
  handleRuntimeMessage(event);
});

scope.postMessage({ kind: "workerReady" });
