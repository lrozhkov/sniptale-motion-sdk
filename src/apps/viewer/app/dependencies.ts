import {
  DEFAULT_LOAD_TIMEOUT_MS,
  DEFAULT_RENDER_TIMEOUT_MS,
  MAX_ASSET_BYTES,
  MAX_RENDER_PIXELS,
  createRequestId,
  clamp,
} from "../../../sdk/protocol.js";
import {
  appendCopyLabel,
  buildControlsWithDefaults,
  createUniquePresetId,
  deepClone,
  normalizeHandles,
  normalizePresets,
  normalizeScenes as normalizeEditorScenes,
  normalizeTimeline,
} from "../editor/model.js";
import {
  createAssetLayer,
  createUniqueAssetId,
  getAssetUsageCount,
  getAssetUsageLayers,
  isSafeSvgAssetText,
  normalizeAuthorAssetMimeType,
  validateAuthorSvgAsset,
  withAssetLayerTypeDefaults,
} from "../assets/model.js";
import { renderAssetsPanel as renderAssetsPanelView } from "../assets/panel.js";
import {
  captureEditorSnapshot as captureEditorSnapshotState,
  commitEditorHistory,
  createEditorCommand,
  recordEditorCommand as recordEditorCommandState,
  restoreEditorSnapshotState,
} from "../editor/history.js";
import {
  createInputFrames,
  drawSampleScene,
} from "../../../sdk/sample-scene.js";
import { loadDemoPack } from "../../../sdk/validator.js";
import { includesLocalDemoPack, includesLocalEffects } from "./build-flags.js";
import { drawEmptyPreview, loadEmptyStartupPack } from "./empty-content.js";
import {
  emptyLocalEffectCatalog,
  loadLocalEffectCatalog,
} from "../effect-file/local-catalog.js";
import {
  getLocale,
  setLocale,
  t,
  translateText,
} from "../../../shared/i18n/index.js";
import {
  completePending,
  completeRender,
  postToSandboxWithTimeout,
  refreshPendingSandboxRequestTimeout,
} from "../transport/sandbox-client.js";
import {
  buildEffectFileAssets,
  buildEffectFileSource,
  buildTemplateJson,
} from "../effect-file/builder.js";
import {
  normalizeEffectFilePayload,
  validateSniptaleEffectFile as validateSniptaleEffectFileSource,
} from "../effect-file/validation.js";
import {
  categorizeValidationIssue as categorizeValidationIssueModel,
  collectEditorValidationErrors as collectEditorValidationErrorsModel,
  collectEditorValidationIssues as collectEditorValidationIssuesModel,
  createValidationIssue as createValidationIssueModel,
  hasInvalidTiming as hasInvalidTimingModel,
  isRangeInvalid as isRangeInvalidModel,
} from "../validation/model.js";
import {
  calculateFrameTimelineRangeState,
  calculatePannedTimelineOffset,
  calculateTimelineViewport,
  calculateTimelineZoomState,
  getTimelineTickStep,
  snapTimelineDuration,
  snapTimelineTime,
  timelineDurationPercentForViewport,
  timelinePercentForViewport,
} from "../timeline/viewport.js";
import {
  createEmptyBindingReads,
  formatBindingReadsTitle,
  normalizeBindingReads,
} from "./binding-reads.js";
import {
  DEFAULT_SIDEBAR_WIDTH,
  SUPPORTED_AUTHOR_ASSET_TYPES,
  TIMELINE_LABEL_WIDTH,
  TIMING_BOUNDARY_TOLERANCE,
  isSafeLocalAssetPath,
} from "./constants.js";
import { createViewerRefs } from "./refs.js";
import { createViewerState } from "./state.js";

export const viewerAppDependencies = {
  DEFAULT_LOAD_TIMEOUT_MS,
  DEFAULT_RENDER_TIMEOUT_MS,
  DEFAULT_SIDEBAR_WIDTH,
  MAX_ASSET_BYTES,
  MAX_RENDER_PIXELS,
  SUPPORTED_AUTHOR_ASSET_TYPES,
  TIMELINE_LABEL_WIDTH,
  TIMING_BOUNDARY_TOLERANCE,
  appendCopyLabel,
  buildControlsWithDefaults,
  buildEffectFileAssets,
  buildEffectFileSource,
  buildTemplateJson,
  calculateFrameTimelineRangeState,
  calculatePannedTimelineOffset,
  calculateTimelineViewport,
  calculateTimelineZoomState,
  captureEditorSnapshotState,
  categorizeValidationIssueModel,
  clamp,
  collectEditorValidationErrorsModel,
  collectEditorValidationIssuesModel,
  commitEditorHistory,
  completePending,
  completeRender,
  createAssetLayer,
  createEditorCommand,
  createEmptyBindingReads,
  createInputFrames,
  createRequestId,
  createUniqueAssetId,
  createUniquePresetId,
  createValidationIssueModel,
  createViewerRefs,
  createViewerState,
  deepClone,
  drawSampleScene: includesLocalDemoPack ? drawSampleScene : drawEmptyPreview,
  formatBindingReadsTitle,
  getAssetUsageCount,
  getAssetUsageLayers,
  getLocale,
  getTimelineTickStep,
  hasInvalidTimingModel,
  isRangeInvalidModel,
  isSafeLocalAssetPath,
  isSafeSvgAssetText,
  loadDemoPack: includesLocalDemoPack ? loadDemoPack : loadEmptyStartupPack,
  loadLocalEffectCatalog: includesLocalEffects
    ? loadLocalEffectCatalog
    : emptyLocalEffectCatalog,
  normalizeAuthorAssetMimeType,
  normalizeBindingReads,
  normalizeEditorScenes,
  normalizeEffectFilePayload,
  normalizeHandles,
  normalizePresets,
  normalizeTimeline,
  postToSandboxWithTimeout,
  refreshPendingSandboxRequestTimeout,
  recordEditorCommandState,
  renderAssetsPanelView,
  restoreEditorSnapshotState,
  setLocale,
  snapTimelineDuration,
  snapTimelineTime,
  t,
  timelineDurationPercentForViewport,
  timelinePercentForViewport,
  translateText,
  validateAuthorSvgAsset,
  validateSniptaleEffectFileSource,
  withAssetLayerTypeDefaults,
};

export type ViewerAppDependencies = typeof viewerAppDependencies;
