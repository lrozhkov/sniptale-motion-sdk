import { createInspectorFieldActions } from "../inspector/fields.js";
import { createInspectorTimingActions } from "../inspector/timing.js";
import { createInspectorKeyframeSelectionActions } from "../inspector/keyframe-selection.js";
import { createInspectorKeyframeEditActions } from "../inspector/keyframe-edit.js";
import { createInspectorKeyframeCurveActions } from "../inspector/keyframe-curve.js";
import { createInspectorKeyframeCurveHandleActions } from "../inspector/keyframe-curve-handles.js";
import { createInspectorCurveEditorActions } from "../inspector/curve-editor.js";
import { createInspectorKeyframeSegmentActions } from "../inspector/keyframe-segment.js";
import { createInspectorNumberFieldActions } from "../inspector/number-fields.js";
import { createInspectorLayerPropertyActions } from "../inspector/layer-properties.js";
import { createInspectorLayerContentActions } from "../inspector/layer-content-fields.js";
import { createCanvasSelectionGeometryActions } from "../canvas/selection-geometry.js";
import { createCanvasSelectionHudActions } from "../canvas/selection-hud.js";
import { createCanvasTransformHandleActions } from "../canvas/transform-handles.js";
import { createLayerHierarchyActions } from "../layers/hierarchy-controller.js";
import { createCanvasSelectionTargetActions } from "../canvas/selection-target.js";
import { createCanvasHitTestingActions } from "../canvas/hit-testing.js";
import { createCanvasMarqueeActions } from "../canvas/marquee.js";
import { createCanvasSelectionLevelActions } from "../canvas/selection-level.js";
import { createCanvasIsolationBreadcrumbActions } from "../canvas/isolation-breadcrumb.js";
import { createCanvasTransformDragActions } from "../canvas/transform-drag.js";
import { createCanvasScaleDragActions } from "../canvas/scale-drag.js";
import { createCanvasPivotDragActions } from "../canvas/pivot-drag.js";
import { createCanvasPivotKeyboardActions } from "../canvas/pivot-keyboard.js";
import { createCanvasKeyboardTransformActions } from "../canvas/keyboard-transform.js";
import { createCanvasSelectionTransformActions } from "../canvas/selection-transform.js";
import { createCanvasSelectionTransformKeyboardActions } from "../canvas/selection-transform-keyboard.js";
import { createLayerEditorCapabilityActions } from "../layers/editor-capabilities.js";
import { createCanvasGuideActions } from "../canvas/guide-snap.js";
import { createCanvasPathOverlayActions } from "../canvas/path-overlay.js";
import { createCanvasPathPointDragActions } from "../canvas/path-point-drag.js";
import { createCanvasMotionPathHandleDragActions } from "../canvas/motion-path-handle-drag.js";
import { createCanvasEditablePathPointDragActions } from "../canvas/editable-path-point-drag.js";
import { createCanvasPathPointHitTestingActions } from "../canvas/path-point-hit-testing.js";
import { createCanvasGeometryActions } from "../canvas/layer-geometry.js";
import { createCanvasHitGeometryActions } from "../canvas/layer-hit-geometry.js";
import { createInspectorMotionPathActions } from "../inspector/motion-path-point.js";
import { createCanvasMotionPathUpdateActions } from "../canvas/motion-path-updates.js";
import { createCanvasMotionPathBatchActions } from "../canvas/motion-path-batch-updates.js";
import { createCanvasMotionPathKindActions } from "../canvas/motion-path-kind-updates.js";
import { createCanvasPropertyActions } from "../canvas/property-updates.js";
import { createCanvasMotionPathSelectionActions } from "../canvas/motion-path-selection.js";
import { createTimelineLayerReparentActions } from "../timeline/interaction/layer-reparent.js";
import { createTimelineMarqueeActions } from "../timeline/interaction/marquee.js";
import { createTimelinePlaybackRangeActions } from "../timeline/interaction/playback-range.js";
import { createTimelinePointerActions } from "../timeline/interaction/pointer-actions.js";
import { createPointerDragActions } from "./pointer-drag.js";
import { createLazyGraphEditorActions } from "../graph-editor/lazy.js";
import { createKeyframeActions } from "../timeline/interaction/keyframe-actions.js";
import { createTimelineActions } from "../timeline/actions.js";
import { createTimelineViewActions } from "../timeline/view/actions.js";
import { createInspectorOwnershipActions } from "../inspector/ownership-actions.js";
import { createTimelineSelectionStateActions } from "../timeline/model/selection-state.js";
import { createTimelineNavigationActions } from "../timeline/model/selection-navigation.js";
import { createKeyframeNavigationActions } from "../timeline/model/keyframe-navigation.js";
import { createKeyframeSelectionActions } from "../timeline/model/keyframe-selection-state.js";
import { syncTimelineSelection } from "../timeline/view/selection.js";
import { reconcileTimelineSelection } from "../timeline/model/selection-consistency.js";
import { createTimelineSelectionRangeActions } from "../timeline/model/selection-range.js";
import { createTimelineRangeActions } from "../timeline/model/ownership.js";
import { getPrimaryKeyframeSelection } from "../timeline/model/selection-consistency.js";
import { findSceneIdAtTime, findPhaseIdAtTime } from "./misc.js";
import { getTrackLayerId } from "../layers/properties.js";
import { createOwnershipLinkActions } from "../timeline/model/ownership-links.js";
import { createSceneMoveActions } from "../timeline/model/scene-move-plans.js";
import { createTimelineOwnershipPredicates } from "../timeline/model/ownership-predicates.js";
import { createClipMoveActions } from "../timeline/model/clip-move-plans.js";
import { createPhaseMoveActions } from "../timeline/model/phase-move-plans.js";
import { createLazyExportFeatures } from "./lazy-export-features.js";
import { logDiagnostic } from "./diagnostics.js";
import { dataUrlToBlob, rasterizeSvgAsset } from "../assets/file-import.js";
import { createAssetBitmap, createRenderAssets } from "../rendering/assets.js";
import { createTimelineRowTree } from "../timeline/model/row-tree.js";
import { normalizeScenes } from "../templates/fallbacks.js";
import { getTrackKeyframesForParent } from "../timeline/view/property-track.js";
import { renderCurrentFrame } from "../rendering/service.js";
import { getSelectedKeyframeRefs } from "../timeline/interaction/keyframes.js";
import { resolveRenderTemplateSnapshot } from "../rendering/model-cache.js";
import { createViewerRefs } from "./refs.js";
import { createViewerState } from "./state.js";
import { viewerAppDependencies } from "./dependencies.js";
import type { ViewerAppContext } from "./context.js";
import { getEffectiveTemplate } from "../templates/controller.js";
import {
  getEffectiveTimeline,
  getEditorOverride,
  setEditorOverride,
  getEffectiveDuration,
} from "../editor/store.js";

export function createViewerContext(): ViewerAppContext {
  const refs = createViewerRefs();
  const previewContext = refs.canvas.getContext("2d");
  if (!previewContext)
    throw new Error("Viewer Canvas 2D context is unavailable.");
  const ctx: ViewerAppContext = {
    ...createInspectorFieldActions(() => ctx),
    ...createInspectorTimingActions(() => ctx),
    ...createInspectorKeyframeSelectionActions(() => ctx),
    ...createInspectorKeyframeEditActions(() => ctx),
    ...createInspectorKeyframeCurveActions(() => ctx),
    ...createInspectorKeyframeCurveHandleActions(() => ctx),
    ...createInspectorCurveEditorActions(() => ctx),
    ...createInspectorKeyframeSegmentActions(() => ctx),

    ...createInspectorNumberFieldActions(() => ctx),
    ...createInspectorLayerPropertyActions(() => ctx),
    ...createInspectorLayerContentActions(() => ctx),
    canvasSelectionPlaybackFrame: 0,
    ...createCanvasSelectionGeometryActions(() => ctx),
    ...createCanvasSelectionHudActions(() => ctx),
    ...createCanvasTransformHandleActions(() => ctx),

    ...createLayerHierarchyActions(() => ctx),
    ...createCanvasSelectionTargetActions(() => ctx),
    ...createCanvasHitTestingActions(() => ctx),
    ...createCanvasMarqueeActions(() => ctx),
    ...createCanvasSelectionLevelActions(() => ctx),
    ...createCanvasIsolationBreadcrumbActions(() => ctx),

    ...createCanvasTransformDragActions(() => ctx),
    ...createCanvasScaleDragActions(() => ctx),
    ...createCanvasPivotDragActions(() => ctx),
    ...createCanvasPivotKeyboardActions(() => ctx),
    ...createCanvasKeyboardTransformActions(() => ctx),
    ...createCanvasSelectionTransformActions(() => ctx),
    ...createCanvasSelectionTransformKeyboardActions(() => ctx),

    ...createLayerEditorCapabilityActions(),
    ...createCanvasGuideActions(() => ctx),
    ...createCanvasPathOverlayActions(() => ctx),
    ...createCanvasPathPointDragActions(() => ctx),
    ...createCanvasMotionPathHandleDragActions(() => ctx),
    ...createCanvasEditablePathPointDragActions(() => ctx),
    ...createCanvasPathPointHitTestingActions(() => ctx),

    ...createCanvasGeometryActions(() => ctx),
    ...createCanvasHitGeometryActions(() => ctx),
    ...createLazyExportFeatures(() => ctx),
    ...createTimelineActions(() => ctx),
    ...createCanvasMotionPathUpdateActions(() => ctx),
    ...createCanvasMotionPathBatchActions(() => ctx),
    ...createCanvasMotionPathKindActions(() => ctx),
    ...createInspectorMotionPathActions(() => ctx),
    ...createCanvasPropertyActions(() => ctx),
    ...createCanvasMotionPathSelectionActions(() => ctx),
    ...createTimelinePointerActions(() => ctx),
    ...createTimelineLayerReparentActions(() => ({
      ...ctx,
      beginEditorCommand: (command) => ctx.beginEditorCommand(command),
      setSelectedLayers: (ids, template) =>
        ctx.setSelectedLayers(ids, template),
      renderTimelineEditor: (source) => ctx.renderTimelineEditor(source),
    })),
    ...createTimelineMarqueeActions(() => ctx),
    ...createTimelinePlaybackRangeActions(() => ctx),
    ...createPointerDragActions(() => ctx),
    ...createKeyframeActions(() => ctx),
    ...createLazyGraphEditorActions(
      () => ctx,
      () =>
        import("../graph-editor/actions.js").then((module) =>
          module.createGraphEditorRuntimeActions(() => ctx),
        ),
    ),
    ...createTimelineViewActions(() => ctx),
    ...createInspectorOwnershipActions(() => ctx),
    ...createTimelineSelectionStateActions(() => ctx),
    ...createTimelineNavigationActions(() => ctx),
    ...createKeyframeNavigationActions(() => ctx),
    ...createKeyframeSelectionActions(() => ctx),
    ...createTimelineSelectionRangeActions(() => ctx),
    ...createTimelineRangeActions(() => ctx),

    ...createTimelineOwnershipPredicates(() => ctx),
    ...createClipMoveActions(() => ctx),
    ...createPhaseMoveActions(() => ctx),
    ...createSceneMoveActions(() => ctx),
    ...createOwnershipLinkActions(() => ctx),

    deps: viewerAppDependencies,
    state: createViewerState(),
    refs,
    previewContext,
    lastPlaybackAudioTs: 0,
    playbackAnimationFrame: null,
    playbackRenderTimer: null,
    lastPlaybackRenderTs: 0,
    lastPlaybackTs: 0,
    lastPlaybackUiTs: 0,
    logDiagnostic(message, level) {
      logDiagnostic(ctx, message, level);
    },
    dataUrlToBlob(dataUrl, fallbackMimeType) {
      return dataUrlToBlob(ctx, dataUrl, fallbackMimeType);
    },
    createAssetBitmap(asset) {
      return createAssetBitmap(ctx, asset);
    },
    rasterizeSvgAsset(asset) {
      return rasterizeSvgAsset(ctx, asset);
    },
    createRenderAssets(template) {
      return createRenderAssets(ctx, template);
    },
    createTimelineRowTree(template) {
      return createTimelineRowTree(ctx, template);
    },
    normalizeScenes(scenes, duration) {
      return normalizeScenes(ctx, scenes, duration);
    },
    getTrackKeyframesForParent(track, scene, timeline, parent) {
      return getTrackKeyframesForParent(ctx, track, scene, timeline, parent);
    },
    renderCurrentFrame(options) {
      return renderCurrentFrame(ctx, options);
    },
    syncTimelineSelection(template) {
      syncTimelineSelection(ctx, template);
    },
    reconcileTimelineSelection(template) {
      reconcileTimelineSelection(ctx, template);
    },
    getTrackLayerId,
    findSceneIdAtTime(template, time) {
      return findSceneIdAtTime(ctx, template, time);
    },
    findPhaseIdAtTime(template, time, layerId) {
      return findPhaseIdAtTime(ctx, template, time, layerId);
    },
    getPrimaryKeyframeSelection() {
      return getPrimaryKeyframeSelection(ctx.state);
    },
    getSelectedKeyframeRefs() {
      return getSelectedKeyframeRefs(ctx);
    },
    getEditorOverride(template) {
      return getEditorOverride(ctx, template);
    },
    setEditorOverride(patch) {
      setEditorOverride(ctx, patch);
    },
    getEffectiveDuration(template) {
      return getEffectiveDuration(ctx, template);
    },
    getEffectiveTemplate(template) {
      return getEffectiveTemplate(ctx, template);
    },
    getRenderTemplateSnapshot(template) {
      return resolveRenderTemplateSnapshot(ctx, template);
    },
    getEffectiveTimeline(template) {
      return getEffectiveTimeline(ctx, template);
    },
  };
  return ctx;
}
