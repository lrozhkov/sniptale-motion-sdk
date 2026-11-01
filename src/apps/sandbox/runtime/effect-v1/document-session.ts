import type { SandboxRuntimeMessage } from "../message-boundary.js";
import type { SandboxSessionOptions } from "../session-model.js";
import {
  validateEffectV1Document,
  type EffectV1Document,
} from "../../../../sdk/effect-v1/index.js";
import { createEffectV1GraphRenderer } from "./interpreter.js";

export function validateSandboxEffectDocument(
  postToParent: (message: unknown) => void,
  runtime: SandboxSessionOptions["runtime"],
  message: Extract<SandboxRuntimeMessage, { kind: "validateEffectDocument" }>,
): void {
  const validation = validateEffectV1Document(message.document);
  let error: string | undefined;
  if (!validation.ok || !validation.document) {
    const diagnostic = validation.diagnostics[0];
    error = diagnostic
      ? `${diagnostic.code} ${diagnostic.path}: ${diagnostic.message}`
      : "Invalid v1 effect document.";
  } else {
    try {
      createEffectV1GraphRenderer(validation.document, runtime);
    } catch (reason) {
      error = reason instanceof Error ? reason.message : String(reason);
    }
  }
  postToParent({
    ...(error ? { error } : {}),
    kind: "validateEffectDocumentResult",
    ok: !error,
    requestId: message.requestId,
  });
}

export async function loadSandboxEffectDocument(
  postToParent: (message: unknown) => void,
  registry: SandboxSessionOptions["registry"],
  runtime: SandboxSessionOptions["runtime"],
  message: Extract<SandboxRuntimeMessage, { kind: "loadEffectDocument" }>,
): Promise<void> {
  try {
    if (
      !registry.loadedModules.has(message.moduleId) ||
      (message.revision !== undefined &&
        registry.moduleRevisions.get(message.moduleId) !== message.revision)
    ) {
      const validation = validateEffectV1Document(message.document, {
        presentationPolicy: "retained",
      });
      if (!validation.ok || !validation.document) {
        const diagnostic = validation.diagnostics[0];
        throw new Error(
          diagnostic
            ? `${diagnostic.code} ${diagnostic.path}: ${diagnostic.message}`
            : "Invalid v1 effect document.",
        );
      }
      registerDocument(validation.document, registry, runtime);
      registry.loadedModules.set(message.moduleId, true);
      if (message.revision !== undefined)
        registry.moduleRevisions.set(message.moduleId, message.revision);
    }
    postToParent({
      compositionIds: registry.getCompositionIds(),
      effectIds: registry.getEffectIds(),
      kind: "loadEffectDocumentResult",
      moduleId: message.moduleId,
      ok: true,
      requestId: message.requestId,
    });
  } catch (error) {
    postToParent({
      compositionIds: [],
      effectIds: [],
      error: error instanceof Error ? error.message : String(error),
      kind: "loadEffectDocumentResult",
      moduleId: message.moduleId,
      ok: false,
      requestId: message.requestId,
    });
  }
}

function registerDocument(
  document: EffectV1Document,
  registry: SandboxSessionOptions["registry"],
  runtime: SandboxSessionOptions["runtime"],
): void {
  const renderer = createEffectV1GraphRenderer(document, runtime);
  if (document.kind === "standalone") {
    registry.registerComposition(renderer);
  } else {
    registry.registerEffect(renderer);
  }
}
