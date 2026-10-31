import { isEffectV1ExportableTemplate } from "./effect-file/builder.js";
import type { ViewerAppContext } from "./app/context.js";
import {
  getLayerGeometryForTest,
  getLayerPathPointsForTest,
  getSelectedLayerGeometryForTest,
} from "./test-api-geometry.js";
import { getViewerStateForTest } from "./test-api-state.js";
import { installTimelineStressModelForTest } from "./test-api-performance.js";

export interface EffectsViewerTestApi {
  exportTemplateJson: (...args: any[]) => any;
  exportEffectFile: (...args: any[]) => any;
  getTemplateJsonForTest: (...args: any[]) => any;
  profileTemplateFrame: (...args: any[]) => any;
  validateEffectFileForTest: (...args: any[]) => any;
  importEffectFileForTest: (...args: any[]) => any;
  getTimeline: (...args: any[]) => any;
  renderTemplate: (...args: any[]) => any;
  renderTemplateFrame: (...args: any[]) => any;
  setControl: (...args: any[]) => any;
  applyPresetForTest: (...args: any[]) => any;
  duplicatePresetForTest: (...args: any[]) => any;
  deletePresetForTest: (...args: any[]) => any;
  savePresetForTest: (...args: any[]) => any;
  resetTimeline: (...args: any[]) => any;
  testBindTemplateJson: (...args: any[]) => any;
  getState: (...args: any[]) => any;
  refreshRendererContractCoverageForTest: (...args: any[]) => any;
  setRendererContractCoverageForTest: (...args: any[]) => any;
  getContractValidationIssuesForTest: (...args: any[]) => any;
  getCanonicalEditorState: (...args: any[]) => any;
  getLayerGeometryForTest: (...args: any[]) => any;
  getLayerPathPointsForTest: (...args: any[]) => any;
  getSelectedLayerGeometryForTest: (...args: any[]) => any;
  setPreviewRenderCostForTest: (...args: any[]) => any;
  triggerSandboxTimeoutForTest: (...args: any[]) => any;
  moveKeyframe: (...args: any[]) => any;
  movePhase: (...args: any[]) => any;
  moveTrack: (...args: any[]) => any;
  setKeyframeHandles: (...args: any[]) => any;
  installTimelineStressModelForTest: (...args: any[]) => any;
}

export function installViewerTestApi(ctx: ViewerAppContext): void {
  window.effectsViewer = {
    exportTemplateJson() {
      return ctx.assertExportable("Export blocked")
        ? ctx.buildCurrentTemplateJson()
        : null;
    },
    exportEffectFile() {
      return isEffectV1ExportableTemplate(ctx.state.currentTemplate) &&
        ctx.assertExportable("Effect file export blocked")
        ? ctx.buildCurrentEffectFile()
        : null;
    },
    getTemplateJsonForTest: () => ctx.buildCurrentTemplateJson(),
    async profileTemplateFrame(templateId, time, directPresentation = false) {
      await renderTemplateFrame(ctx, templateId, time, {
        directPresentation: Boolean(directPresentation),
        profile: true,
      });
      return ctx.deps.deepClone(ctx.state.lastRenderProfile);
    },
    validateEffectFileForTest(source) {
      return ctx.validateCurrentEffectFileSource(source);
    },
    importEffectFileForTest(source) {
      return ctx.importEffectFileSource(
        source,
        "test-import.sniptale-effect.json",
      );
    },
    getTimeline() {
      return ctx.getEffectiveTimeline();
    },
    async renderTemplate(templateId, time) {
      await renderTemplateFrame(ctx, templateId, time);
      return ctx.refs.canvas.toDataURL("image/png");
    },
    async renderTemplateFrame(templateId, time) {
      await renderTemplateFrame(ctx, templateId, time);
    },
    async setControl(id, value) {
      ctx.state.controls[id] = value;
      ctx.renderControls(ctx.state.currentTemplate);
      await ctx.renderCurrentFrame();
      return ctx.refs.canvas.toDataURL("image/png");
    },
    async applyPresetForTest(presetId) {
      await ctx.applyPreset(presetId);
      return ctx.refs.canvas.toDataURL("image/png");
    },
    duplicatePresetForTest(presetId) {
      return ctx.duplicatePreset(presetId);
    },
    deletePresetForTest(presetId) {
      return ctx.deletePreset(presetId);
    },
    savePresetForTest() {
      return ctx.saveCurrentAsPreset();
    },
    async resetTimeline() {
      if (ctx.state.currentTemplate) {
        await ctx.resetEditorToSource({
          deleteDraft: true,
          discardHistory: true,
        });
        ctx.state.keyframeClipboard = null;
        ctx.state.pendingAssetReplaceId = null;
        ctx.state.canvasTransformDragActive = false;
        ctx.state.canvasTransformPreview = null;
        ctx.state.dragSuppressClickKey = null;
        ctx.state.dragSuppressClickTarget = null;
        ctx.state.dragSuppressClickUntil = 0;
        ctx.state.selectedPresetId = null;
        ctx.setPreviewZoom("fit");
        ctx.setPreviewGuides(false);
        ctx.setPreviewSnap(false);
        ctx.setMoveLinkedKeys(true);
        ctx.setSidebarCollapsed(false);
        ctx.setTimelineEditorHeight(330);
        ctx.clearPlaybackRange();
        ctx.state.timelineOffset = 0;
        ctx.state.timelineZoom = 1;
        ctx.state.rendererContractReads = ctx.deps.createEmptyBindingReads();
        ctx.state.rendererContractCoverageReady = false;
        ctx.state.rendererContractCoverageLockedForTest = false;
        ctx.state.rendererContractTemplateId = ctx.state.currentTemplate.id;
        ctx.state.expandedSceneIds = ctx.createExpandedSceneIdSet(
          ctx.state.currentTemplate,
        );
        ctx.state.expandedTimelineRowIds = ctx.createExpandedTimelineRowIdSet(
          ctx.state.currentTemplate,
        );
        ctx.refs.timelineZoomInput.value = "1";
        ctx.refs.timelineTracks.scrollLeft = 0;
        ctx.refs.timelineTracks.scrollTop = 0;
        ctx.renderTimelineEditor(ctx.state.currentTemplate);
        ctx.updateExportAvailability();
        ctx.refs.timelineTracks.scrollLeft = 0;
        ctx.refs.timelineTracks.scrollTop = 0;
        await ctx.renderCurrentFrame();
        await ctx.refreshRendererContractCoverage();
      }
      return undefined;
    },
    testBindTemplateJson(jsonText) {
      try {
        return ctx.validateBoundTemplateJson(JSON.parse(jsonText));
      } catch {
        ctx.refs.timelineSaveStatus.textContent = ctx.deps.t(
          "viewer.status.rejectedMalformedJson",
          "Rejected malformed JSON",
        );
        ctx.logDiagnostic("Bound JSON is malformed.", "error");
        return false;
      }
    },
    getState() {
      return getViewerStateForTest(ctx);
    },
    async refreshRendererContractCoverageForTest() {
      ctx.state.rendererContractCoverageLockedForTest = false;
      await ctx.refreshRendererContractCoverage();
      return ctx.deps.deepClone(ctx.state.rendererContractReads);
    },
    async setRendererContractCoverageForTest(reads) {
      if (!ctx.state.currentTemplate) {
        return null;
      }
      const startedAt = performance.now();
      while (
        (ctx.state.rendererContractRefreshing ||
          ctx.state.renderInFlight ||
          ctx.state.renderQueued) &&
        performance.now() - startedAt < ctx.deps.DEFAULT_RENDER_TIMEOUT_MS
      ) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      if (
        ctx.state.rendererContractRefreshing ||
        ctx.state.renderInFlight ||
        ctx.state.renderQueued
      ) {
        throw new Error("Renderer contract coverage refresh did not finish.");
      }
      ctx.state.rendererContractTemplateId = ctx.state.currentTemplate.id;
      ctx.state.rendererContractReads = ctx.deps.normalizeBindingReads(reads);
      ctx.state.rendererContractCoverageReady = true;
      ctx.state.rendererContractCoverageLockedForTest = true;
      ctx.updateExportAvailability();
      ctx.renderValidationPanel(ctx.state.currentTemplate);
      ctx.renderRendererBindingsPanel(ctx.state.currentTemplate);
      return ctx.deps.deepClone(ctx.state.rendererContractReads);
    },
    getContractValidationIssuesForTest() {
      return ctx.state.currentTemplate
        ? ctx.deps.deepClone(
            ctx.collectEditorValidationIssues(
              ctx.getEffectiveTemplate(ctx.state.currentTemplate),
            ),
          )
        : [];
    },
    getCanonicalEditorState() {
      return ctx.getCanonicalEditorState();
    },
    getLayerGeometryForTest(layerId) {
      return getLayerGeometryForTest(ctx, layerId);
    },
    getLayerPathPointsForTest(layerId) {
      return getLayerPathPointsForTest(ctx, layerId);
    },
    getSelectedLayerGeometryForTest() {
      return getSelectedLayerGeometryForTest(ctx);
    },
    setPreviewRenderCostForTest(milliseconds) {
      ctx.state.averageFullRenderMs = Math.max(0, Number(milliseconds) || 0);
      return ctx.state.averageFullRenderMs;
    },
    installTimelineStressModelForTest(layerCount = 120) {
      return installTimelineStressModelForTest(ctx, layerCount);
    },
    async triggerSandboxTimeoutForTest() {
      try {
        await ctx.requestSandbox(
          {
            kind: "testUnresponsiveRequest",
            requestId: ctx.deps.createRequestId("test-timeout"),
          },
          25,
        );
        return { name: null, recoveryStarted: false };
      } catch (error) {
        return {
          name: error instanceof Error ? error.name : "UnknownError",
          recoveryStarted: Boolean((error as any)?.recoveryStarted),
        };
      }
    },
    async moveKeyframe(trackId, keyframeId, time) {
      ctx.state.selectedItem = { keyframeId, trackId, type: "keyframe" };
      ctx.state.selectedKeyframes = [{ keyframeId, trackId }];
      await ctx.updateSelectedKeyframe({ time });
      return ctx.refs.canvas.toDataURL("image/png");
    },
    async movePhase(phaseId, delta) {
      const template = ctx.state.currentTemplate;
      const timeline = ctx.getEffectiveTimeline(template);
      const phase = timeline.phases.find((item) => item.id === phaseId);
      if (template && phase && !phase.locked) {
        phase.start = ctx.deps.clamp(
          phase.start + Number(delta || 0),
          0,
          template.duration - phase.duration,
        );
        ctx.state.timelineOverrides.set(
          template.id,
          ctx.deps.normalizeTimeline(timeline, template.duration),
        );
        ctx.renderTimelineEditor(template);
        await ctx.renderCurrentFrame();
      }
      return ctx.refs.canvas.toDataURL("image/png");
    },
    async moveTrack(trackId, delta) {
      const template = ctx.state.currentTemplate;
      const timeline = ctx.getEffectiveTimeline(template);
      const track = timeline.tracks.find((item) => item.id === trackId);
      if (template && track?.keyframes.length) {
        const minTime = Math.min(...track.keyframes.map((item) => item.time));
        const maxTime = Math.max(...track.keyframes.map((item) => item.time));
        const deltaTime = ctx.deps.clamp(
          Number(delta || 0),
          -minTime,
          template.duration - maxTime,
        );
        for (const keyframe of track.keyframes) {
          keyframe.time = ctx.deps.clamp(
            keyframe.time + deltaTime,
            0,
            template.duration,
          );
        }
        track.keyframes.sort((a, b) => a.time - b.time);
        ctx.state.timelineOverrides.set(
          template.id,
          ctx.deps.normalizeTimeline(timeline, template.duration),
        );
        ctx.renderTimelineEditor(template);
        await ctx.renderCurrentFrame();
      }
      return ctx.refs.canvas.toDataURL("image/png");
    },
    async setKeyframeHandles(trackId, keyframeId, handles) {
      ctx.state.selectedItem = { keyframeId, trackId, type: "keyframe" };
      ctx.state.selectedKeyframes = [{ keyframeId, trackId }];
      await ctx.updateSelectedKeyframe({ handles });
      return ctx.refs.canvas.toDataURL("image/png");
    },
  };
}

async function renderTemplateFrame(
  ctx: ViewerAppContext,
  templateId: string,
  time: number,
  options: any = {},
): Promise<void> {
  if (ctx.state.currentTemplate?.id !== templateId) {
    await ctx.selectTemplate(templateId);
  }
  ctx.refs.timeSlider.value = String(time);
  ctx.updateTimelinePlayhead();
  await ctx.renderCurrentFrame({ forceFull: true, ...options });
}
