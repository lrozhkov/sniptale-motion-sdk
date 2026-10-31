import { bindViewerAction } from "../../app/bind-action.js";
import type { EditorTemplate } from "../../templates/model.js";

import type { EditorTimeline } from "../../editor/model-types.js";

import type { TimelineScene } from "../model/row-tree-model.js";

import type {
  TimelineViewSource,
  TimelineLane,
  TimelineBlockOptions,
  TimelineSceneSummary,
} from "./model.js";
import type { ViewerAppContext } from "../../app/context.js";

function renderTimelineRuler(
  ctx: ViewerAppContext,
  template: TimelineViewSource,
  timeline: EditorTimeline,
): void {
  const contentRect = ctx.getTimelineContentMetrics(ctx.refs.timelineRuler);
  ctx.refs.timelineRuler.innerHTML = "";
  const duration = timeline.duration || template.duration || 1;
  const viewport = ctx.getTimelineViewport(duration);
  const tickStep = ctx.deps.getTimelineTickStep(viewport.span);
  ctx.refs.timelineRuler.onpointerdown = ctx.beginRulerScrub;
  for (const time of ctx.getVisibleTimelineTicks(duration)) {
    const tick = document.createElement("span");
    tick.className = "timeline-ruler-tick";
    const percent = ctx.timelinePercent(time, duration);
    tick.style.left = `${ctx.timelineContentPixel(time, duration, ctx.refs.timelineRuler, contentRect)}px`;
    if (percent < 1) {
      tick.classList.add("edge-start");
    } else if (percent > 99) {
      tick.classList.add("edge-end");
    }
    tick.textContent = formatTimelineTickLabel(ctx, time, tickStep);
    ctx.refs.timelineRuler.append(tick);
  }
  const range = document.createElement("span");
  range.className = "timeline-playback-range";
  range.dataset.playbackRange = "ruler";
  range.hidden = true;
  ctx.refs.timelineRuler.append(range);
  const playhead = document.createElement("span");
  playhead.className = "timeline-playhead";
  playhead.dataset.playhead = "ruler";
  ctx.refs.timelineRuler.append(playhead);
  ctx.refs.timelineRulerPlayhead = playhead;
  const snapIndicator = document.createElement("span");
  snapIndicator.className = "timeline-snap-indicator";
  snapIndicator.dataset.snapIndicator = "ruler";
  ctx.refs.timelineRuler.append(snapIndicator);
  ctx.updateTimelineViewportLabel(duration);
  ctx.updateTimelinePlaybackRangeOverlay();
}
function formatTimelineTickLabel(
  ctx: ViewerAppContext,
  time: number,
  tickStep: number,
): string {
  if (tickStep < 0.1) {
    return ctx.formatSeconds(time, 2);
  }
  if (tickStep < 1) {
    return ctx.formatSeconds(time, 1);
  }
  return ctx.formatSeconds(time, 0);
}
function decorateSceneLaneLabel(
  ctx: ViewerAppContext,
  lane: TimelineLane,
  scene: TimelineScene,
  expanded: boolean,
  summary: TimelineSceneSummary | null | undefined,
): void {
  lane.label.classList.add(
    "scene-lane-label",
    "timeline-lane-label-single-line",
  );
  if (summary) {
    lane.row.dataset.sceneSummary = summary.compact;
    lane.label.title = `${ctx.deps.translateText(scene.label, scene.id) || scene.id}\n${summary.full}`;
  }
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = `scene-toggle${expanded ? " expanded" : ""}`;
  toggle.dataset.sceneId = scene.id;
  toggle.replaceChildren(ctx.createViewerIcon("chevronRight"));
  toggle.setAttribute(
    "aria-label",
    expanded
      ? ctx.deps.t("viewer.timeline.collapseRow", "Collapse row")
      : ctx.deps.t("viewer.timeline.expandRow", "Expand row"),
  );
  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    ctx.toggleSceneExpansion(scene.id);
  });
  lane.label.prepend(toggle);
  lane.label.addEventListener("dblclick", (event) => {
    event.preventDefault();
    ctx.toggleSceneExpansion(scene.id);
  });
}
function getSceneTimelineSummary(
  ctx: ViewerAppContext,
  template: EditorTemplate,
  timeline: EditorTimeline,
  scene: TimelineScene,
): TimelineSceneSummary {
  const scenes = ctx.normalizeScenes(template.scenes ?? [], template.duration);
  const globalLayerIds = ctx.getGlobalTimelineLayerIds(template, scenes);
  const clips = (template.clips ?? []).filter(
    (clip) =>
      !globalLayerIds.has(clip.layerId) && ctx.clipBelongsToScene(clip, scene),
  ).length;
  const phases = (timeline.phases ?? []).filter((phase) => {
    const phaseLayerIds = ctx.getPhaseTrackLayerIds(timeline, phase.id);
    return (
      ![...phaseLayerIds].some((layerId) => globalLayerIds.has(layerId)) &&
      ctx.phaseBelongsToScene(phase, scene)
    );
  }).length;
  let tracks = 0;
  let keyframes = 0;
  for (const track of timeline.tracks ?? []) {
    const trackLayerId = ctx.getTrackLayerId(track);
    if (trackLayerId !== null && globalLayerIds.has(trackLayerId)) {
      continue;
    }
    const sceneKeyframes = (track.keyframes ?? []).filter((keyframe) =>
      ctx.keyframeBelongsToScene(track, keyframe, scene, timeline),
    );
    if (sceneKeyframes.length === 0 && track.sceneId !== scene.id) {
      continue;
    }
    tracks += 1;
    keyframes += sceneKeyframes.length;
  }
  return {
    compact: ctx.deps
      .t(
        "viewer.timeline.sceneSummaryCompact",
        "{clips} clips · {phases} phases · {tracks} tracks",
      )
      .replace("{clips}", String(clips))
      .replace("{phases}", String(phases))
      .replace("{tracks}", String(tracks)),
    full: ctx.deps
      .t(
        "viewer.timeline.sceneSummaryFull",
        "{clips} clips · {phases} phases · {tracks} tracks · {keys} keyframes",
      )
      .replace("{clips}", String(clips))
      .replace("{phases}", String(phases))
      .replace("{tracks}", String(tracks))
      .replace("{keys}", String(keyframes)),
  };
}
function toggleSceneExpansion(ctx: ViewerAppContext, sceneId: string): void {
  if (ctx.state.expandedSceneIds.has(sceneId)) {
    ctx.state.expandedSceneIds.delete(sceneId);
    ctx.setTimelineRowExpanded("scene", sceneId, false);
  } else {
    ctx.state.expandedSceneIds.add(sceneId);
    ctx.setTimelineRowExpanded("scene", sceneId, true);
  }
  ctx.renderTimelineStructure(ctx.state.currentTemplate);
}
function isSceneExpanded(ctx: ViewerAppContext, sceneId: string): boolean {
  return (
    ctx.state.expandedSceneIds.has(sceneId) ||
    ctx.isTimelineRowExpanded("scene", sceneId)
  );
}
function createTimelineLane(
  ctx: ViewerAppContext,
  labelText: string,
  kindText: string = "",
): TimelineLane {
  const row = document.createElement("div");
  row.className = "timeline-lane";
  const label = document.createElement("div");
  label.className = "timeline-lane-label";
  label.classList.toggle("timeline-lane-label-single-line", !kindText);
  label.title = kindText ? `${labelText}\n${kindText}` : labelText;
  const title = document.createElement("span");
  title.className = "timeline-lane-title";
  title.textContent = labelText;
  label.append(title);
  if (kindText) {
    const kind = document.createElement("span");
    kind.className = "timeline-lane-kind";
    kind.textContent = kindText;
    label.append(kind);
  }
  const body = document.createElement("div");
  body.className = "timeline-lane-body";
  body.addEventListener("click", (event) => ctx.seekFromTimelineEvent(event));
  body.addEventListener("pointerdown", (event) => {
    if (
      (event.altKey || event.shiftKey) &&
      !body.classList.contains("track-lane-body")
    ) {
      ctx.beginTimelineMarqueeSelection(event);
    }
  });
  row.append(label, body);
  return { body, label, row };
}

function decorateTimelineRowDepth(
  _ctx: ViewerAppContext,
  row: HTMLElement,
  depth: number = 0,
  rowIndex: number | null = null,
): void {
  const normalizedDepth = Math.max(0, Number(depth) || 0);
  row.dataset.timelineDepth = String(normalizedDepth);
  row.style.setProperty("--timeline-depth", String(normalizedDepth));
  row.setAttribute("role", "treeitem");
  row.setAttribute("aria-level", String(normalizedDepth + 1));
  if (rowIndex !== null) {
    row.dataset.timelineRowIndex = String(rowIndex);
  }
}
function createTimelineBlock(
  _ctx: ViewerAppContext,
  { className, id, invalid, label, left, locked, width }: TimelineBlockOptions,
): HTMLButtonElement {
  const block = document.createElement("button");
  block.type = "button";
  block.className = `timeline-block ${className}${locked ? " locked" : ""}${invalid ? " invalid" : ""}`;
  block.style.left = `${left}%`;
  block.style.width = `${Math.max(0.4, width)}%`;
  const labelNode = document.createElement("span");
  labelNode.className = "timeline-block-label";
  labelNode.textContent = label;
  block.append(labelNode);
  block.dataset.itemId = id;
  block.title = label;
  return block;
}

export function createTimelineEditorActions(
  getContext: () => ViewerAppContext,
) {
  return {
    renderTimelineRuler: bindViewerAction(renderTimelineRuler, getContext),
    decorateSceneLaneLabel: bindViewerAction(
      decorateSceneLaneLabel,
      getContext,
    ),
    getSceneTimelineSummary: bindViewerAction(
      getSceneTimelineSummary,
      getContext,
    ),
    toggleSceneExpansion: bindViewerAction(toggleSceneExpansion, getContext),
    isSceneExpanded: bindViewerAction(isSceneExpanded, getContext),
    createTimelineLane: bindViewerAction(createTimelineLane, getContext),
    decorateTimelineRowDepth: bindViewerAction(
      decorateTimelineRowDepth,
      getContext,
    ),
    createTimelineBlock: bindViewerAction(createTimelineBlock, getContext),
  };
}
