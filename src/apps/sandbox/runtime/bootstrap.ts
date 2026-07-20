import { createSandboxRegistry } from "./registry.js";
import { parseSandboxRuntimeMessage } from "./message-boundary.js";
import { createSandboxParentTransport } from "./parent-transport.js";
import { createSandboxRuntimeFacade } from "./runtime-facade.js";
import { createSandboxSession } from "./session.js";
import { createSandboxExecutionRouter } from "./execution-router.js";
import { parseDirectRenderPortConnection } from "./direct-render-port.js";

export function bootstrapSandboxRuntime(): void {
  const registry = createSandboxRegistry();
  const runtime = createSandboxRuntimeFacade(registry);
  const parentTransport = createSandboxParentTransport(
    parent,
    document.referrer,
  );
  const router = createSandboxExecutionRouter({
    createForegroundSession: (postToParent) =>
      createSandboxSession({ postToParent, registry, runtime }),
    createWorker:
      typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined"
        ? () =>
            new Worker(new URL("../render-worker.ts", import.meta.url), {
              name: "sniptale-render-worker",
              type: "module",
            })
        : null,
    postToParent: parentTransport.post,
  });

  Object.defineProperty(globalThis, "SniptaleSandboxRuntime", {
    configurable: false,
    enumerable: false,
    value: runtime,
    writable: false,
  });

  window.addEventListener("message", (event) => {
    if (!parentTransport.accepts(event)) {
      return;
    }
    const directConnection = parseDirectRenderPortConnection(event.data);
    if (directConnection) {
      router.connectDirectRenderPort(
        directConnection.port as Transferable,
        directConnection.presentationSurface as Transferable | undefined,
      );
      return;
    }
    const message = parseSandboxRuntimeMessage(event.data);
    if (!message) {
      return;
    }
    void router.handleMessage(message);
  });

  parentTransport.post({ kind: "runtimeReady" });
}
