import type {
  PlaybackRunState,
  PlaybackRunMode,
  PlaybackRunPhase,
} from "./state.js";
export type { PlaybackRunMode, PlaybackRunPhase } from "./state.js";
import type { ViewerAppContext } from "../app/context.js";

type PlaybackPhaseInputs = {
  sandboxRecoveryPending?: boolean;
  playing?: boolean;
  previewCacheWarmActive?: boolean;
  previewCacheEnabled?: boolean;
  previewFrameCacheComplete?: boolean;
  previewVideoCache?: {
    preparePromise?: Promise<unknown> | null;
    preparing?: boolean;
    recording?: boolean;
    finalizing?: boolean;
    playbackActive?: boolean;
  };
};

export type PlaybackRunToken = {
  generation: number;
  templateId: string | null;
};

export function isPlaybackPreparationPhase(phase: PlaybackRunPhase): boolean {
  return (
    phase === "preparing-frame-cache" ||
    phase === "preparing-video-cache" ||
    phase === "paused-preparation"
  );
}

export function beginPlaybackRunState(ctx: ViewerAppContext): PlaybackRunToken {
  const run = ensurePlaybackRunState(ctx.state);
  run.generation += 1;
  run.mode = resolvePlaybackRunMode(ctx.state);
  run.phase = "starting";
  run.templateId = ctx.state.currentTemplate?.id ?? null;
  return { generation: run.generation, templateId: run.templateId };
}

export function isPlaybackRunCurrent(
  ctx: ViewerAppContext,
  token: PlaybackRunToken,
): boolean {
  const run = ensurePlaybackRunState(ctx.state);
  return (
    ctx.state.playing === true &&
    run.generation === token.generation &&
    run.templateId === token.templateId &&
    (ctx.state.currentTemplate?.id ?? null) === token.templateId
  );
}

export function setPlaybackRunPhase(
  ctx: ViewerAppContext,
  token: PlaybackRunToken,
  phase: PlaybackRunPhase,
): boolean {
  if (!isPlaybackRunCurrent(ctx, token)) {
    return false;
  }
  ensurePlaybackRunState(ctx.state).phase = phase;
  return true;
}

export function pausePlaybackRunState(
  ctx: ViewerAppContext,
  preservePreparation: boolean,
): void {
  const run = ensurePlaybackRunState(ctx.state);
  run.generation += 1;
  run.phase = preservePreparation ? "paused-preparation" : "idle";
}

export function stopPlaybackRunState(
  ctx: ViewerAppContext,
  phase: "idle" | "recovering" = "idle",
): void {
  const run = ensurePlaybackRunState(ctx.state);
  run.generation += 1;
  run.phase = phase;
  run.templateId = ctx.state.currentTemplate?.id ?? null;
}

export function resetPlaybackRunState(ctx: ViewerAppContext): void {
  const run = ensurePlaybackRunState(ctx.state);
  run.generation += 1;
  run.mode = resolvePlaybackRunMode(ctx.state);
  run.phase = "idle";
  run.templateId = ctx.state.currentTemplate?.id ?? null;
}

export function syncPlaybackRunState(ctx: ViewerAppContext): PlaybackRunPhase {
  const run = ensurePlaybackRunState(ctx.state);
  run.mode = resolvePlaybackRunMode(ctx.state);
  run.phase = resolvePlaybackRunPhase(ctx.state, run.phase);
  run.templateId = ctx.state.currentTemplate?.id ?? null;
  return run.phase;
}

export function resolvePlaybackRunPhase(
  state: PlaybackPhaseInputs,
  currentPhase: PlaybackRunPhase = "idle",
): PlaybackRunPhase {
  if (state.sandboxRecoveryPending || currentPhase === "recovering") {
    return state.sandboxRecoveryPending ? "recovering" : "idle";
  }
  const videoCache = state.previewVideoCache;
  const preparingVideo = Boolean(
    videoCache?.preparePromise ||
    videoCache?.preparing ||
    videoCache?.recording ||
    videoCache?.finalizing,
  );
  if (!state.playing) {
    return state.previewCacheWarmActive || preparingVideo
      ? "paused-preparation"
      : "idle";
  }
  if (preparingVideo) {
    return "preparing-video-cache";
  }
  if (state.previewCacheWarmActive) {
    return "preparing-frame-cache";
  }
  if (videoCache?.playbackActive) {
    return "cached-video-playback";
  }
  if (
    state.previewCacheEnabled !== false &&
    state.previewFrameCacheComplete === true
  ) {
    return "cached-frame-playback";
  }
  return "live";
}

function resolvePlaybackRunMode(state: {
  previewCacheEnabled?: boolean;
}): PlaybackRunMode {
  return state.previewCacheEnabled === false ? "live" : "cache";
}

function ensurePlaybackRunState(state: {
  playbackRun?: PlaybackRunState;
  previewCacheEnabled?: boolean;
  currentTemplate?: { id: string } | null;
}): PlaybackRunState {
  state.playbackRun ??= {
    generation: 0,
    mode: resolvePlaybackRunMode(state),
    phase: "idle",
    templateId: state.currentTemplate?.id ?? null,
  };
  return state.playbackRun;
}
