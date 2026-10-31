import type { createViewerRefs } from "./refs.js";
import type { createViewerState } from "./state.js";
import type { ViewerAppDependencies } from "./dependencies.js";
import type { EditorTimelineSource } from "../editor/timeline-source.js";
import type { EditorTemplate } from "../templates/model.js";
import type { EditorTimeline } from "../editor/model-types.js";

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
  getEditorOverride(template?: unknown): Record<string, unknown>;
  setEditorOverride(patch: unknown): void;
  getEffectiveDuration(template?: unknown): number;
  getEffectiveTemplate(template?: unknown): EditorTemplate | null;
  getEffectiveTimeline(template?: EditorTimelineSource | null): EditorTimeline;
  [viewerAction: string]: any;
}
