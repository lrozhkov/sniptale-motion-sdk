import { bindViewerAction } from "../app/bind-action.js";
import type {
  CanonicalEditorState,
  EditorStoreActions,
  HistoryCommitOptions,
} from "./contract.js";
import type { EditorCommand } from "./history.js";
import type { ViewerAppContext } from "../app/context.js";
import {
  readEditorTimeline,
  type EditorTimelineSource,
} from "./timeline-source.js";
import type { EditorTimeline } from "./model-types.js";
import { readTemplatePatch, readTemplateSource } from "../templates/source.js";

export function getEditorOverride(
  ctx: ViewerAppContext,
  template: unknown = ctx.state.currentTemplate,
): Record<string, unknown> {
  if (
    template === null ||
    typeof template !== "object" ||
    Array.isArray(template) ||
    !("id" in template) ||
    typeof template.id !== "string"
  )
    return {};
  const override: unknown = ctx.state.editorOverrides.get(template.id);
  return readTemplatePatch(override ?? {});
}
export function setEditorOverride(ctx: ViewerAppContext, patch: unknown): void {
  if (!ctx.state.currentTemplate) return;
  const template = readTemplateSource(ctx.state.currentTemplate);
  const current = ctx.getEditorOverride(template);
  ctx.state.editorOverrides.set(template.id, {
    ...current,
    ...readTemplatePatch(patch),
  });
}

function applyEditorCommand<Result>(
  ctx: ViewerAppContext,
  command: unknown,
  mutate: () => Result,
): Result | null {
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
function beginEditorCommand(
  ctx: ViewerAppContext,
  command: unknown,
  options: HistoryCommitOptions = {},
): void {
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
function recordEditorCommand(
  ctx: ViewerAppContext,
  command: EditorCommand,
): void {
  ctx.deps.recordEditorCommandState(ctx.state, command);
}
function getCanonicalEditorState(
  ctx: ViewerAppContext,
  template: unknown = ctx.state.currentTemplate,
): CanonicalEditorState {
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
export function getEffectiveDuration(
  ctx: ViewerAppContext,
  template: unknown = ctx.state.currentTemplate,
): number {
  const duration =
    template !== null && typeof template === "object" && "duration" in template
      ? template.duration
      : undefined;
  const value = ctx.getEditorOverride(template).duration ?? duration ?? 1;
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error("Invalid editor template duration.");
  return value;
}

function setCurrentDuration(ctx: ViewerAppContext, duration: number): void {
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
function renderTimelineEditor(
  ctx: ViewerAppContext,
  template: EditorTimelineSource | null,
): void {
  if (!template) return;
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
function timelineDurationPercent(timeSpan: number, duration: number): number {
  return (
    ((Number(timeSpan) || 0) / Math.max(0.001, Number(duration) || 1)) * 100
  );
}
function snapDuration(ctx: ViewerAppContext, duration: number): number {
  return ctx.deps.snapTimelineDuration(duration, {
    fps: Number(ctx.refs.fpsInput.value) || 30,
    snapMode: ctx.state.snapMode,
  });
}
export function createEditorStoreActions(
  getContext: () => ViewerAppContext,
): EditorStoreActions {
  return {
    getEditorOverride: bindViewerAction(getEditorOverride, getContext),
    setEditorOverride: bindViewerAction(setEditorOverride, getContext),
    getEffectiveDuration: bindViewerAction(getEffectiveDuration, getContext),
    getEffectiveTimeline: bindViewerAction(getEffectiveTimeline, getContext),
    applyEditorCommand: (command, mutate) =>
      applyEditorCommand(getContext(), command, mutate),
    beginEditorCommand: bindViewerAction(beginEditorCommand, getContext),
    recordEditorCommand: bindViewerAction(recordEditorCommand, getContext),
    getCanonicalEditorState: bindViewerAction(
      getCanonicalEditorState,
      getContext,
    ),
    setCurrentDuration: bindViewerAction(setCurrentDuration, getContext),
    renderTimelineEditor: bindViewerAction(renderTimelineEditor, getContext),
    timelineDurationPercent,
    snapDuration: bindViewerAction(snapDuration, getContext),
  };
}
