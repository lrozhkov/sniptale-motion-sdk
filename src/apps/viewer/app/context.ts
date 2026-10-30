import type { createViewerRefs } from "./refs.js";
import type { createViewerState } from "./state.js";
import type { ViewerAppDependencies } from "./dependencies.js";

export type ViewerFunction = (...args: any[]) => any;

export interface ViewerAppContext {
  deps: ViewerAppDependencies;
  lastPlaybackAudioTs: number;
  playbackAnimationFrame: number | null;
  playbackRenderTimer: number | null;
  lastPlaybackRenderTs: number;
  lastPlaybackTs: number;
  lastPlaybackUiTs: number;
  previewContext: CanvasRenderingContext2D;
  refs: ReturnType<typeof createViewerRefs>;
  state: ReturnType<typeof createViewerState>;
  [viewerAction: string]: any;
}
