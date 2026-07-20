export type SandboxRenderProgressPhase =
  | "queued"
  | "rendering"
  | "preview-cache-store";

type RenderProgressSink = (message: Record<string, unknown>) => void;

// Keep this below the public protocol's original 900 ms frame timeout. During
// Vite HMR the iframe/worker can be newer than the already bootstrapped viewer,
// so a 1 s heartbeat is too late to protect an otherwise healthy cache render.
const RENDER_PROGRESS_INTERVAL_MS = 250;
const RENDER_PROGRESS_MAX_DURATION_MS = 45_000;
const PREVIEW_CACHE_PROGRESS_MAX_DURATION_MS = 10 * 60_000;

export function beginSandboxRenderProgress({
  previewCacheEnabled = false,
  post,
  requestId,
  sequenceId,
}: {
  previewCacheEnabled?: boolean;
  post: RenderProgressSink;
  requestId: string;
  sequenceId: number;
}) {
  let active = true;
  let heartbeatCount = 0;
  let phase: SandboxRenderProgressPhase = "queued";
  const maxHeartbeats = Math.ceil(
    (previewCacheEnabled
      ? PREVIEW_CACHE_PROGRESS_MAX_DURATION_MS
      : RENDER_PROGRESS_MAX_DURATION_MS) / RENDER_PROGRESS_INTERVAL_MS,
  );
  const heartbeat = globalThis.setInterval(() => {
    if (!active || heartbeatCount >= maxHeartbeats) {
      stop();
      return;
    }
    heartbeatCount += 1;
    try {
      post({
        kind: "renderFrameProgress",
        phase,
        requestId,
        sequenceId,
      });
    } catch {
      stop();
    }
  }, RENDER_PROGRESS_INTERVAL_MS);

  function setPhase(nextPhase: SandboxRenderProgressPhase): void {
    phase = nextPhase;
  }

  function stop(): void {
    if (!active) {
      return;
    }
    active = false;
    globalThis.clearInterval(heartbeat);
  }

  return { setPhase, stop };
}
