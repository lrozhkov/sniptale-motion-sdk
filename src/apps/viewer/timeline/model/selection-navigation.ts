import type { ViewerAppContext } from "../../app/context.js";

function cycleTimelineSelection(ctx: ViewerAppContext, direction) {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  if (!template) {
    return;
  }
  const items = ctx.getVisibleTimelineSelectionItems(template);
  if (items.length === 0) {
    return;
  }
  const currentIndex = items.findIndex((item) =>
    ctx.isTimelineSelectionItemCurrent(item),
  );
  const nextIndex =
    currentIndex >= 0
      ? (currentIndex + direction + items.length) % items.length
      : direction < 0
        ? items.length - 1
        : 0;
  const nextItem = items[nextIndex];
  ctx.applyTimelineSelectionItem(nextItem);
  const rowIndex = ctx.getTimelineItemRowIndex(
    ctx.state.currentTemplate,
    nextItem,
  );
  if (rowIndex >= 0) {
    ctx.scrollTimelineRowIntoView(rowIndex, "nearest");
  }
  ctx.renderTimelineStructure(ctx.state.currentTemplate);
  ctx.syncTimelineSelection(ctx.state.currentTemplate);
  ctx.scrollSelectedTimelineItemIntoView();
}

function getVisibleTimelineSelectionItems(ctx: ViewerAppContext, template) {
  const items = [];
  const appendTracks = (trackRows, sceneId) => {
    for (const { keyframes, track } of trackRows) {
      items.push({ sceneId, trackId: track.id, type: "track" });
      for (const keyframe of keyframes) {
        items.push({
          keyframeId: keyframe.id,
          sceneId,
          trackId: track.id,
          type: "keyframe",
        });
      }
    }
  };
  const tree = ctx.createTimelineRowTree(template);
  appendLayerRows(tree.globalLayers ?? [], null);
  for (const sceneRow of tree.scenes) {
    const { scene } = sceneRow;
    items.push({ sceneId: scene.id, type: "scene" });
    if (!ctx.isSceneExpanded(scene.id)) {
      continue;
    }
    appendLayerRows(sceneRow.layers, scene.id);
    for (const phaseRow of sceneRow.scenePhases) {
      items.push({
        phaseId: phaseRow.phase.id,
        sceneId: scene.id,
        type: "phase",
      });
      if (ctx.isTimelineRowExpanded("scenePhase", phaseRow.expansionId)) {
        appendTracks(phaseRow.tracks, scene.id);
      }
    }
    if (
      sceneRow.sceneTracks.length > 0 &&
      ctx.isTimelineRowExpanded("sceneTracks", scene.id)
    ) {
      appendTracks(sceneRow.sceneTracks, scene.id);
    }
  }
  return items;

  function appendLayerRows(layerRows, sceneId): void {
    for (const layerRow of layerRows) {
      items.push({ layerId: layerRow.layerId, sceneId, type: "layer" });
      if (layerRow.kind !== "group" && layerRow.clip) {
        items.push({ layerId: layerRow.layerId, sceneId, type: "clip" });
      }
      const rowType = layerRow.kind === "group" ? "group" : "layer";
      if (!ctx.isTimelineRowExpanded(rowType, layerRow.expansionId)) {
        continue;
      }
      if (layerRow.kind === "group") {
        appendLayerRows(layerRow.children, sceneId);
        continue;
      }
      for (const phaseRow of layerRow.phases) {
        items.push({
          phaseId: phaseRow.phase.id,
          sceneId,
          type: "phase",
        });
        if (ctx.isTimelineRowExpanded("phase", phaseRow.expansionId)) {
          appendTracks(phaseRow.tracks, sceneId);
        }
      }
      appendTracks(layerRow.directTracks, sceneId);
    }
  }
}

function isTimelineSelectionItemCurrent(ctx: ViewerAppContext, item) {
  const current = ctx.state.selectedItem ?? { type: "effect" };
  if (item.type !== current.type) {
    return false;
  }
  if (item.type === "scene" && current.type === "scene") {
    return item.sceneId === current.sceneId;
  }
  if (
    (item.type === "clip" || item.type === "layer") &&
    (current.type === "clip" || current.type === "layer")
  ) {
    return item.layerId === current.layerId;
  }
  if (item.type === "phase" && current.type === "phase") {
    return item.phaseId === current.phaseId;
  }
  if (item.type === "track" && current.type === "track") {
    return item.trackId === current.trackId;
  }
  if (item.type === "keyframe" && current.type === "keyframe") {
    return (
      item.trackId === current.trackId && item.keyframeId === current.keyframeId
    );
  }
  return false;
}

function applyTimelineSelectionItem(ctx: ViewerAppContext, item) {
  if (item.sceneId) {
    ctx.state.expandedSceneIds.add(item.sceneId);
  }
  if (item.type === "scene") {
    ctx.selectSceneBlock(item.sceneId);
  } else if (item.type === "layer") {
    ctx.selectLayer(item.layerId);
  } else if (item.type === "clip") {
    ctx.selectClipBlock(item.layerId);
  } else if (item.type === "phase") {
    ctx.selectPhaseBlock(item.phaseId);
  } else if (item.type === "track") {
    ctx.selectTrackLane(item.trackId);
  } else if (item.type === "keyframe") {
    ctx.state.selectedClips = [];
    ctx.state.selectedLayers = [];
    ctx.state.selectedPhases = [];
    ctx.state.selectedScenes = [];
    ctx.setSelectedKeyframes(
      [{ keyframeId: item.keyframeId, trackId: item.trackId }],
      { render: false },
    );
  }
}

function scrollSelectedTimelineItemIntoView(ctx: ViewerAppContext) {
  const range = ctx.getSelectedTimelineRange(
    ctx.getEffectiveTemplate(ctx.state.currentTemplate),
  );
  requestAnimationFrame(() => {
    const element = range?.selector
      ? ctx.refs.timelineTracks.querySelector(range.selector)
      : null;
    scrollTimelineElementHorizontallyIntoView(ctx, element);
  });
}

function focusInspectorForSelection(ctx: ViewerAppContext) {
  if (!ctx.state.currentTemplate || ctx.state.selectedItem?.type === "effect") {
    return;
  }
  ctx.setSidebarGroup("inspect");
  const tab = getInspectorFocusTabForSelection(ctx, ctx.state.selectedItem);
  ctx.setInspectorTab(tab);
  const section = ctx.refs.inspectorPanel.querySelector(
    `[data-inspector-section="${tab}"]:not([hidden])`,
  );
  const focusable = (section ?? ctx.refs.inspectorPanel).querySelector(
    "input:not([disabled]), select:not([disabled]), button:not([disabled])",
  );
  if (focusable instanceof HTMLElement) focusable.focus();
}

function getInspectorFocusTabForSelection(_ctx: ViewerAppContext, item) {
  if (item?.type === "layer") {
    return "transform";
  }
  if (["clip", "phase", "scene", "track"].includes(item?.type)) {
    return "timing";
  }
  if (item?.type === "keyframe") {
    return "timing";
  }
  if (item?.type === "asset") {
    return "ownership";
  }
  return "summary";
}

function frameSelectedTimelineItem(ctx: ViewerAppContext) {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  if (!template) {
    return;
  }
  const range = ctx.getSelectedTimelineRange(template);
  if (!range) {
    ctx.seekToTime(Number(ctx.refs.timeSlider.value) || 0);
    return;
  }
  if (range.sceneId) {
    ctx.state.expandedSceneIds.add(range.sceneId);
  }
  const selectedItem = {
    ...ctx.state.selectedItem,
    sceneId: range.sceneId,
  };
  if (selectedItem.type === "layer" || selectedItem.type === "clip") {
    ctx.revealTimelineLayerById(selectedItem.layerId, {
      focus: false,
      select: false,
    });
  }
  ctx.frameTimelineRange(range.start, range.end, template.duration);
  const rowIndex = ctx.getTimelineItemRowIndex(template, selectedItem);
  if (rowIndex >= 0) {
    ctx.scrollTimelineRowIntoView(rowIndex);
  }
  ctx.renderTimelineViewport(ctx.state.currentTemplate);
  requestAnimationFrame(() => {
    const selector = range.selector
      ? ctx.refs.timelineTracks.querySelector(range.selector)
      : null;
    scrollTimelineElementHorizontallyIntoView(ctx, selector);
  });
}

function scrollTimelineElementHorizontallyIntoView(ctx, element) {
  if (!element) {
    return;
  }
  const container = ctx.refs.timelineTracks;
  const containerRect = container.getBoundingClientRect();
  const rect = element.getBoundingClientRect();
  if (rect.left < containerRect.left) {
    container.scrollLeft += rect.left - containerRect.left - 8;
  } else if (rect.right > containerRect.right) {
    container.scrollLeft += rect.right - containerRect.right + 8;
  }
}

export function installModelSelectionNavigationOwner(
  ctx: ViewerAppContext,
): void {
  ctx.cycleTimelineSelection = cycleTimelineSelection.bind(undefined, ctx);
  ctx.getVisibleTimelineSelectionItems = getVisibleTimelineSelectionItems.bind(
    undefined,
    ctx,
  );
  ctx.isTimelineSelectionItemCurrent = isTimelineSelectionItemCurrent.bind(
    undefined,
    ctx,
  );
  ctx.applyTimelineSelectionItem = applyTimelineSelectionItem.bind(
    undefined,
    ctx,
  );
  ctx.scrollSelectedTimelineItemIntoView =
    scrollSelectedTimelineItemIntoView.bind(undefined, ctx);
  ctx.focusInspectorForSelection = focusInspectorForSelection.bind(
    undefined,
    ctx,
  );
  ctx.getInspectorFocusTabForSelection = getInspectorFocusTabForSelection.bind(
    undefined,
    ctx,
  );
  ctx.frameSelectedTimelineItem = frameSelectedTimelineItem.bind(
    undefined,
    ctx,
  );
  ctx.scrollTimelineElementHorizontallyIntoView =
    scrollTimelineElementHorizontallyIntoView.bind(undefined, ctx);
}
