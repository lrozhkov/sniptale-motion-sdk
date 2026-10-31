import type { CanvasDisplayActions } from "../canvas/display-contract.js";
import type { LayerHierarchyActions } from "../layers/hierarchy-contract.js";
import type { CanvasSelectionActions } from "../canvas/selection-contract.js";
import type { CanvasTransformActions } from "../canvas/transform-contract.js";
import type { LayerEditorCapabilityActions } from "../layers/editor-capabilities.js";
import type { CanvasGuideActions } from "../canvas/guide-contract.js";
import type { CanvasPathActions } from "../canvas/path-contract.js";
import type { CanvasGeometryActions } from "../canvas/geometry-contract.js";
import type {
  InspectorMotionPathActions,
  InspectorPropertyActions,
} from "../inspector/contract.js";
import type {
  CanvasMotionPathUpdateActions,
  CanvasPropertyActions,
  CanvasMotionPathSelectionActions,
} from "../canvas/contract.js";
import type {
  TimelineLayerGestureActions,
  TimelineSelectionGestureActions,
  TimelinePointerActions,
} from "../timeline/interaction/pointer-contract.js";
import type { PointerDragActions } from "./pointer-contract.js";
import type { GraphEditorActions } from "../graph-editor/contract.js";
import type { KeyframeEditActions } from "../timeline/interaction/keyframe-contract.js";
import type { TimelineRowTreeActions } from "../timeline/model/row-tree-contract.js";
import type { TimelineVirtualizationActions } from "../timeline/virtualization/contract.js";
import type { TimelineViewportActions } from "../timeline/interaction/viewport-contract.js";
import type { TimelineTimingActions } from "../timeline/model/timing-contract.js";
import type { TimelineSurfaceActions } from "../timeline/view/surface-contract.js";
import type { TimelineRowViewActions } from "../timeline/view/row-contract.js";
import type { InspectorOwnershipActions } from "../inspector/ownership-contract.js";
import type { TimelineSelectionActions } from "../timeline/model/selection-actions.js";
import type { TimelineModelActions } from "../timeline/model/actions.js";
import type { TrackLayerSource } from "../layers/model.js";
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

export interface ViewerAppContext
  extends
    CanvasDisplayActions,
    LayerHierarchyActions,
    CanvasSelectionActions,
    CanvasTransformActions,
    LayerEditorCapabilityActions,
    CanvasGuideActions,
    CanvasPathActions,
    CanvasGeometryActions,
    CanvasMotionPathUpdateActions,
    InspectorMotionPathActions,
    InspectorPropertyActions,
    CanvasPropertyActions,
    CanvasMotionPathSelectionActions,
    Mp4ExportActions,
    KeyframeEditActions,
    GraphEditorActions,
    PointerDragActions,
    TimelineLayerGestureActions,
    TimelineSelectionGestureActions,
    TimelinePointerActions,
    TimelineModelActions,
    TimelineSelectionActions,
    InspectorOwnershipActions,
    TimelineSurfaceActions,
    TimelineRowViewActions,
    TimelineRowTreeActions,
    TimelineVirtualizationActions,
    TimelineViewportActions,
    TimelineTimingActions {
  deps: ViewerAppDependencies;
  canvasSelectionPlaybackFrame: number;
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
  getPrimaryKeyframeSelection(): KeyframeSelectionRef | null;
  getSelectedKeyframeRefs(): KeyframeSelectionRef[];
  getTrackLayerId(track: TrackLayerSource | null | undefined): string | null;
  findSceneIdAtTime(
    template: EditorTimelineSource | null | undefined,
    time: number,
  ): string | null;
  findPhaseIdAtTime(
    template: EditorTimelineSource | null | undefined,
    time: number,
    layerId?: string | null,
  ): string | null;
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
