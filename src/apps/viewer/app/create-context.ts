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
    ...createLazyExportFeatures(() => ctx),
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
