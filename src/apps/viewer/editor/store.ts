import type { ViewerAppContext } from "../app/context.js";
import {
  readEditorTimeline,
  type EditorTimelineSource,
} from "./timeline-source.js";
import type { EditorTimeline } from "./model-types.js";

function getEditorOverride(
  ctx: ViewerAppContext,
  template = ctx.state.currentTemplate,
) {
  if (!template) {
    return {};
  }
  return ctx.state.editorOverrides.get(template.id) ?? {};
}
function setEditorOverride(ctx: ViewerAppContext, patch) {
  if (!ctx.state.currentTemplate) {
    return;
  }
  const current = ctx.getEditorOverride(ctx.state.currentTemplate);
  ctx.state.editorOverrides.set(ctx.state.currentTemplate.id, {
    ...current,
    ...patch,
  });
}
function applyEditorCommand(ctx: ViewerAppContext, command, mutate) {
  if (!ctx.state.currentTemplate) {
    return null;
  }
  const safeCommand = ctx.deps.createEditorCommand(
    command,
    ctx.state.currentTemplate.id,
    Number(ctx.refs.timeSlider.value) || 0,
  );
  ctx.commitHistory(safeCommand.type);
  const result = mutate();
  ctx.recordEditorCommand(safeCommand);
  return result;
}
function beginEditorCommand(ctx: ViewerAppContext, command, options: any = {}) {
  if (!ctx.state.currentTemplate) {
    return;
  }
  const safeCommand = ctx.deps.createEditorCommand(
    command,
    ctx.state.currentTemplate.id,
    Number(ctx.refs.timeSlider.value) || 0,
  );
  ctx.commitHistory(safeCommand.type, options);
  ctx.recordEditorCommand(safeCommand);
}
function recordEditorCommand(ctx: ViewerAppContext, command) {
  ctx.deps.recordEditorCommandState(ctx.state, command);
}
function getCanonicalEditorState(
  ctx: ViewerAppContext,
  template = ctx.state.currentTemplate,
) {
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  return {
    assets: effectiveTemplate
      ? ctx.deps.buildEffectFileAssets(effectiveTemplate, ctx.state.assets)
      : [],
    commands: ctx.deps.deepClone(ctx.state.editorCommands),
    controls: ctx.deps.deepClone(ctx.state.controls),
    history: {
      future: ctx.state.historyFuture.length,
      past: ctx.state.historyPast.length,
    },
    selectedItem: ctx.deps.deepClone(
      ctx.state.selectedItem ?? { type: "effect" },
    ),
    selectedClips: ctx.deps.deepClone(ctx.state.selectedClips ?? []),
    selectedLayers: ctx.deps.deepClone(ctx.state.selectedLayers ?? []),
    selectedPresetId: ctx.state.selectedPresetId,
    selectedPhases: ctx.deps.deepClone(ctx.state.selectedPhases ?? []),
    selectedScenes: ctx.deps.deepClone(ctx.state.selectedScenes ?? []),
    selectedKeyframes: ctx.deps.deepClone(ctx.state.selectedKeyframes ?? []),
    template: effectiveTemplate,
    time: Number(ctx.refs.timeSlider.value) || 0,
  };
}
function getEffectiveDuration(
  ctx: ViewerAppContext,
  template = ctx.state.currentTemplate,
) {
  return Number(
    ctx.getEditorOverride(template).duration ?? template?.duration ?? 1,
  );
}
function setCurrentDuration(ctx: ViewerAppContext, duration) {
  if (!ctx.state.currentTemplate || !Number.isFinite(duration)) {
    return;
  }
  ctx.commitHistory("duration");
  const nextDuration = ctx.deps.clamp(duration, 0.5, 120);
  ctx.setEditorOverride({ duration: nextDuration });
  ctx.refs.durationInput.value = String(nextDuration);
  ctx.refs.timeSlider.max = String(nextDuration);
  ctx.refs.timeSlider.value = String(
    ctx.deps.clamp(Number(ctx.refs.timeSlider.value) || 0, 0, nextDuration),
  );
  ctx.clearTimelineSelection();
  ctx.renderTimelineEditor(ctx.state.currentTemplate);
  ctx.renderInspector();
  void ctx.renderCurrentFrame();
}
export function getEffectiveTimeline(
  ctx: ViewerAppContext,
  template: EditorTimelineSource | null = ctx.state.currentTemplate,
): EditorTimeline {
  if (!template) {
    return { duration: 1, phases: [], tracks: [] };
  }
  const override = ctx.state.timelineOverrides.get(template.id);
  const timeline: unknown = ctx.deps.deepClone(
    override ?? template.timeline ?? ctx.createFallbackTimeline(template),
  );
  return readEditorTimeline(
    timeline,
    Number(ctx.getEffectiveDuration(template)),
  );
}
function setEffectiveTimeline(ctx: ViewerAppContext, timeline) {
  if (!ctx.state.currentTemplate) {
    return;
  }
  const normalized = ctx.deps.normalizeTimeline(
    timeline,
    ctx.getEffectiveDuration(ctx.state.currentTemplate),
  );
  ctx.state.timelineOverrides.set(ctx.state.currentTemplate.id, normalized);
  ctx.renderTimelineEditor(ctx.state.currentTemplate);
  void ctx.renderCurrentFrame();
}
function renderTimelineEditor(ctx: ViewerAppContext, template) {
  const startedAt = performance.now();
  ctx.state.timelineFullEditorRenderCount += 1;
  ctx.reconcileTimelineSelection(template);
  const previousTimelineScrollLeft = ctx.refs.timelineTracks.scrollLeft;
  const previousTimelineScrollTop = ctx.refs.timelineTracks.scrollTop;
  ctx.refs.timeSlider.max = String(ctx.getEffectiveDuration(template));
  ctx.refs.durationInput.value = String(ctx.getEffectiveDuration(template));
  const timeline = ctx.getEffectiveTimeline(template);
  ctx.renderLayersPanel(template);
  ctx.renderAssetsPanel(template);
  ctx.renderPresetsPanel(template);
  ctx.updateTemplateContext(template);
  ctx.renderTimelineRuler(template, timeline);
  ctx.renderTimelineTracks(template, timeline);
  ctx.renderCurveEditor(timeline);
  ctx.renderSelectionCrumb(template);
  ctx.updateTimelinePlayhead();
  ctx.renderInspector();
  ctx.renderValidationPanel(template);
  ctx.renderRendererBindingsPanel(template);
  ctx.refs.timelineTracks.scrollLeft = previousTimelineScrollLeft;
  ctx.refs.timelineTracks.scrollTop = previousTimelineScrollTop;
  ctx.updateCanvasSelectionBox();
  ctx.updateExportAvailability();
  ctx.state.lastTimelineSurfaceRenderMs = performance.now() - startedAt;
}
function beginDurationTrim(ctx: ViewerAppContext, event) {
  event.preventDefault();
  event.stopPropagation();
  const template = ctx.state.currentTemplate;
  if (!template) {
    return;
  }
  const body = event.currentTarget.closest(".timeline-lane-body");
  const rect = body.getBoundingClientRect();
  const startX = event.clientX;
  const originalDuration = ctx.getEffectiveDuration(template);
  ctx.clearTimelineSelection();
  ctx.beginEditorCommand({
    payload: { originalDuration },
    type: "setDuration",
  });
  const onMove = (moveEvent) => {
    const deltaTime = ctx.timelineDeltaFromPixels(
      moveEvent.clientX - startX,
      rect,
      template,
    );
    ctx.state.dragMoved =
      ctx.state.dragMoved || Math.abs(moveEvent.clientX - startX) > 2;
    const nextDuration = ctx.snapDuration(
      ctx.deps.clamp(originalDuration + deltaTime, 0.5, 120),
    );
    ctx.setEditorOverride({ duration: nextDuration });
    ctx.refs.timeSlider.max = String(nextDuration);
    ctx.refs.durationInput.value = nextDuration.toFixed(2);
    ctx.refs.timeSlider.value = String(
      ctx.deps.clamp(Number(ctx.refs.timeSlider.value) || 0, 0, nextDuration),
    );
    ctx.renderTimelineEditor(template);
    void ctx.renderCurrentFrame();
  };
  ctx.bindPointerDrag(event.pointerId, event.currentTarget, onMove);
}
function timelineDurationPercent(ctx: ViewerAppContext, timeSpan, duration) {
  return (
    ((Number(timeSpan) || 0) / Math.max(0.001, Number(duration) || 1)) * 100
  );
}
function snapDuration(ctx: ViewerAppContext, duration) {
  return ctx.deps.snapTimelineDuration(duration, {
    fps: Number(ctx.refs.fpsInput.value) || 30,
    snapMode: ctx.state.snapMode,
  });
}
export function installEditorStoreOwner(ctx: ViewerAppContext): void {
  ctx.getEditorOverride = getEditorOverride.bind(undefined, ctx);
  ctx.setEditorOverride = setEditorOverride.bind(undefined, ctx);
  ctx.applyEditorCommand = applyEditorCommand.bind(undefined, ctx);
  ctx.beginEditorCommand = beginEditorCommand.bind(undefined, ctx);
  ctx.recordEditorCommand = recordEditorCommand.bind(undefined, ctx);
  ctx.getCanonicalEditorState = getCanonicalEditorState.bind(undefined, ctx);
  ctx.getEffectiveDuration = getEffectiveDuration.bind(undefined, ctx);
  ctx.setCurrentDuration = setCurrentDuration.bind(undefined, ctx);
  ctx.getEffectiveTimeline = getEffectiveTimeline.bind(undefined, ctx);
  ctx.setEffectiveTimeline = setEffectiveTimeline.bind(undefined, ctx);
  ctx.renderTimelineEditor = renderTimelineEditor.bind(undefined, ctx);
  ctx.beginDurationTrim = beginDurationTrim.bind(undefined, ctx);
  ctx.timelineDurationPercent = timelineDurationPercent.bind(undefined, ctx);
  ctx.snapDuration = snapDuration.bind(undefined, ctx);
}
