import type { ViewerAppContext } from "../../app/context.js";
import {
  findTimelineItemRowIndex,
  findTimelineLayerRowIndex,
  flattenVisibleTimelineRows,
} from "./row-order.js";
import {
  calculateTimelineVirtualWindow,
  shouldRefreshTimelineVirtualWindow,
} from "./window.js";

function beginTimelineVirtualRender(
  ctx: ViewerAppContext,
  tree,
  scrollTop = ctx.refs.timelineTracks.scrollTop,
): void {
  const rows = createTimelineOrderedRows(ctx, tree);
  const rowHeight = getTimelineRowHeight(ctx);
  const window = calculateTimelineVirtualWindow({
    rowCount: rows.length,
    rowHeight,
    scrollTop,
    viewportHeight: ctx.refs.timelineTracks.clientHeight,
  });
  ctx.state.timelineVirtualWindow = window;
  ctx.state.timelineVirtualRows = rows;
  ctx.state.timelineVirtualRowCursor = 0;
  ctx.state.timelineVirtualRendering = true;
  ctx.state.timelineTotalRowCount = rows.length;
  ctx.state.timelineRenderedRowCount = 0;
  ctx.state.timelineVirtualTotalHeight = rows.length * rowHeight;
  ctx.refs.timelineTracks.dataset.virtualized = String(window.virtualized);
  appendVirtualSpacer(ctx, window.start, "before");
}

function claimTimelineVirtualRow(ctx: ViewerAppContext): number | null {
  const index = ctx.state.timelineVirtualRowCursor++;
  const window = ctx.state.timelineVirtualWindow;
  if (!window || index < window.start || index >= window.end) {
    return null;
  }
  ctx.state.timelineRenderedRowCount += 1;
  return index;
}

function endTimelineVirtualRender(ctx: ViewerAppContext): void {
  const window = ctx.state.timelineVirtualWindow;
  if (window) {
    appendVirtualSpacer(ctx, window.rowCount - window.end, "after");
  }
  ctx.state.timelineVirtualRendering = false;
}

function scheduleTimelineVirtualRender(ctx: ViewerAppContext): void {
  if (
    ctx.state.timelineVirtualRendering ||
    ctx.state.timelineVirtualScrollFrame ||
    !shouldRefreshTimelineVirtualWindow(
      ctx.state.timelineVirtualWindow,
      ctx.refs.timelineTracks.scrollTop,
    )
  ) {
    return;
  }
  ctx.state.timelineVirtualScrollFrame = requestAnimationFrame(() => {
    ctx.state.timelineVirtualScrollFrame = 0;
    if (ctx.state.currentTemplate) {
      ctx.renderTimelineStructure(ctx.state.currentTemplate);
    }
  });
}

function getTimelineLayerRowIndex(ctx: ViewerAppContext, template, target) {
  const rows = getTimelineOrderedRows(ctx, template);
  return findTimelineLayerRowIndex(rows, target);
}

function getTimelineItemRowIndex(ctx: ViewerAppContext, template, item) {
  return findTimelineItemRowIndex(getTimelineOrderedRows(ctx, template), item);
}

function scrollTimelineRowIntoView(
  ctx: ViewerAppContext,
  rowIndex: number,
  align: "center" | "nearest" = "center",
): boolean {
  const rowCount = ctx.state.timelineVirtualRows?.length ?? 0;
  if (rowIndex < 0 || rowIndex >= rowCount) {
    return false;
  }
  const rowHeight = getTimelineRowHeight(ctx);
  const viewportHeight = ctx.refs.timelineTracks.clientHeight;
  const rowTop = rowIndex * rowHeight;
  const rowBottom = rowTop + rowHeight;
  const currentTop = ctx.refs.timelineTracks.scrollTop;
  const currentBottom = currentTop + viewportHeight;
  if (
    align === "nearest" &&
    rowTop >= currentTop &&
    rowBottom <= currentBottom
  ) {
    return true;
  }
  const target =
    align === "center"
      ? rowTop - Math.max(0, (viewportHeight - rowHeight) / 2)
      : rowTop < currentTop
        ? rowTop
        : rowBottom - viewportHeight;
  const maxScroll = Math.max(0, rowCount * rowHeight - viewportHeight);
  ctx.refs.timelineTracks.scrollTop = ctx.deps.clamp(target, 0, maxScroll);
  return true;
}

function createTimelineOrderedRows(ctx: ViewerAppContext, tree) {
  return flattenVisibleTimelineRows(tree, {
    isRowExpanded: (type, id) => ctx.isTimelineRowExpanded(type, id),
    isSceneExpanded: (sceneId) => ctx.isSceneExpanded(sceneId),
  });
}

function getTimelineOrderedRows(ctx: ViewerAppContext, template) {
  const tree =
    ctx.state.timelineRenderSnapshot?.templateId === template.id
      ? ctx.state.timelineRenderSnapshot.tree
      : ctx.createTimelineRowTree(template);
  const rows = createTimelineOrderedRows(ctx, tree);
  ctx.state.timelineVirtualRows = rows;
  ctx.state.timelineTotalRowCount = rows.length;
  return rows;
}

function getTimelineRowHeight(ctx: ViewerAppContext): number {
  const value = Number.parseFloat(
    getComputedStyle(ctx.refs.timelineTracks).getPropertyValue(
      "--timeline-row-height",
    ),
  );
  return Number.isFinite(value) && value > 0 ? value : 32;
}

function appendVirtualSpacer(
  ctx: ViewerAppContext,
  rowCount: number,
  position: "after" | "before",
): void {
  if (rowCount <= 0) {
    return;
  }
  const spacer = document.createElement("div");
  spacer.className = `timeline-virtual-spacer ${position}`;
  spacer.style.height = `${rowCount * getTimelineRowHeight(ctx)}px`;
  spacer.setAttribute("aria-hidden", "true");
  ctx.refs.timelineTracks.append(spacer);
}

export function installTimelineVirtualizationOwner(
  ctx: ViewerAppContext,
): void {
  Object.assign(ctx, {
    beginTimelineVirtualRender: beginTimelineVirtualRender.bind(undefined, ctx),
    claimTimelineVirtualRow: claimTimelineVirtualRow.bind(undefined, ctx),
    endTimelineVirtualRender: endTimelineVirtualRender.bind(undefined, ctx),
    getTimelineLayerRowIndex: getTimelineLayerRowIndex.bind(undefined, ctx),
    getTimelineItemRowIndex: getTimelineItemRowIndex.bind(undefined, ctx),
    scheduleTimelineVirtualRender: scheduleTimelineVirtualRender.bind(
      undefined,
      ctx,
    ),
    scrollTimelineRowIntoView: scrollTimelineRowIntoView.bind(undefined, ctx),
  });
}
