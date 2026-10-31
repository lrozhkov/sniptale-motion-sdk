export function resolveViewerRenderFailureMessage(
  translate: (key: string, fallback?: string) => string,
  result: { errorCode?: unknown; error?: unknown },
): string {
  if (result.errorCode === "BACKGROUND_RENDERER_STOPPED") {
    return translate(
      "viewer.rendering.backgroundStopped",
      "Background renderer stopped. Switching to compatibility mode.",
    );
  }
  if (result.errorCode === "WORKER_RENDER_PREPARATION_FAILED") {
    return translate(
      "viewer.rendering.workerPreparationFailed",
      "Could not prepare this frame for background rendering.",
    );
  }
  return typeof result.error === "string"
    ? result.error
    : translate("viewer.rendering.failed", "Render failed.");
}
