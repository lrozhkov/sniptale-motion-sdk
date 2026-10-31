import type { Mp4ExportActions } from "../video-export/actions.js";
import type { ViewerAsset } from "../assets/state.js";
import type { RenderAssetTransfer } from "../rendering/state.js";
import type {
  TimelineRowTree,
  TimelineScene,
  TimelineTrackParent,
} from "../timeline/model/row-tree-model.js";
import type { TimelineKeyframe } from "../../../sdk/types.js";
import type { MotionPathTrack } from "../../../shared/timeline/motion-path.js";
import type { RenderOptions } from "../rendering/state.js";
import type { KeyframeSelectionRef } from "../timeline/model/selection-model.js";
import type { createViewerRefs } from "./refs.js";
import type { createViewerState } from "./state.js";
import type { ViewerAppDependencies } from "./dependencies.js";
import type { EditorTimelineSource } from "../editor/timeline-source.js";
import type { EditorTemplate } from "../templates/model.js";
import type { EditorTimeline } from "../editor/model-types.js";

export interface ViewerAppContext extends Mp4ExportActions {
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
  logDiagnostic(message: string, level?: string): void;
  dataUrlToBlob(dataUrl: string, fallbackMimeType?: string): Blob;
  createAssetBitmap(asset: ViewerAsset): Promise<ImageBitmap>;
  rasterizeSvgAsset(asset: ViewerAsset): Promise<ImageBitmap>;
  createRenderAssets(template: {
    assets?: unknown;
    id?: unknown;
    effectId?: unknown;
  }): Promise<RenderAssetTransfer>;
  createTimelineRowTree(template: unknown): TimelineRowTree;
  normalizeScenes(scenes: unknown, duration?: number): TimelineScene[];
  getTrackKeyframesForParent(
    track: MotionPathTrack,
    scene: TimelineScene,
    timeline: EditorTimeline,
    parent: TimelineTrackParent,
  ): TimelineKeyframe<unknown>[];
  renderCurrentFrame(options?: RenderOptions): Promise<void>;
  getSelectedKeyframeRefs(): KeyframeSelectionRef[];
  getEditorOverride(template?: unknown): Record<string, unknown>;
  setEditorOverride(patch: unknown): void;
  getEffectiveDuration(template?: unknown): number;
  getEffectiveTemplate(template?: unknown): EditorTemplate | null;
  getRenderTemplateSnapshot(
    template?: { id: string } | null,
  ): EditorTemplate | null;
  getEffectiveTimeline(template?: EditorTimelineSource | null): EditorTimeline;
  [viewerAction: string]: any;
}
