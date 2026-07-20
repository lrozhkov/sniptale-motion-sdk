import { loadSandboxRuntimeDefinition } from "../load-session.js";
import { validateSandboxEffectDocument } from "./document-session.js";

export async function handleEffectDocumentMessage({
  canvasPool,
  message,
  registry,
  renderQueue,
  responseSink,
  runtime,
}): Promise<boolean> {
  if (message.kind === "validateEffectDocument") {
    validateSandboxEffectDocument(responseSink, runtime, message);
    return true;
  }
  if (message.kind !== "loadEffectDocument") return false;
  await loadSandboxRuntimeDefinition({
    canvasPool,
    message,
    registry,
    renderQueue,
    responseSink,
    runtime,
  });
  return true;
}
