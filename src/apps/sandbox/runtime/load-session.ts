import { loadSandboxEffectDocument } from "./effect-v1/document-session.js";

export async function loadSandboxRuntimeDefinition({
  canvasPool,
  message,
  registry,
  renderQueue,
  responseSink,
  runtime,
}) {
  await renderQueue;
  canvasPool.close();
  if (message.kind === "loadEffectDocument") {
    await loadSandboxEffectDocument(responseSink, registry, runtime, message);
  }
}
