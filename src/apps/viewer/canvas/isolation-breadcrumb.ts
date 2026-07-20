import type { ViewerAppContext } from "../app/context.js";
import { getLayerAncestorIds, isLayerGroup } from "../layers/hierarchy.js";

function renderCanvasIsolationBreadcrumb(ctx: ViewerAppContext): void {
  const breadcrumb = ctx.refs.canvasIsolationBreadcrumb;
  const path = getCanvasIsolationPath(ctx);
  breadcrumb.hidden = path.length === 0;
  breadcrumb.replaceChildren();
  if (path.length === 0) {
    return;
  }
  const mode = document.createElement("span");
  mode.className = "canvas-isolation-mode";
  mode.textContent = ctx.deps.t(
    "viewer.canvas.isolation.editingInside",
    "Inside",
  );
  breadcrumb.append(mode);
  appendBreadcrumbButton(
    breadcrumb,
    ctx.deps.t("viewer.canvas.isolation.root", "Canvas"),
    () => navigateCanvasIsolation(ctx, path, -1),
  );
  path.forEach((group, index) => {
    appendBreadcrumbSeparator(ctx, breadcrumb);
    const label = ctx.deps.translateText(group.name, group.id);
    if (index === path.length - 1) {
      const current = document.createElement("span");
      current.className = "canvas-isolation-current";
      current.textContent = label;
      current.setAttribute("aria-current", "location");
      current.title = label;
      breadcrumb.append(current);
      return;
    }
    appendBreadcrumbButton(breadcrumb, label, () =>
      navigateCanvasIsolation(ctx, path, index),
    );
  });
}

function getCanvasIsolationPath(ctx: ViewerAppContext): any[] {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  const isolationId = ctx.state.canvasIsolationGroupId;
  if (!template || !isolationId) {
    return [];
  }
  const hierarchy = ctx.getLayerHierarchy(template);
  const current = hierarchy.byId.get(isolationId);
  if (!isLayerGroup(current)) {
    ctx.state.canvasIsolationGroupId = null;
    return [];
  }
  return [
    ...getLayerAncestorIds(hierarchy, isolationId)
      .reverse()
      .map((id) => hierarchy.byId.get(id))
      .filter(isLayerGroup),
    current,
  ];
}

function navigateCanvasIsolation(ctx, path, index: number): void {
  const isolation = index >= 0 ? path[index] : null;
  const selected = path[index + 1] ?? path[0] ?? null;
  ctx.state.canvasIsolationGroupId = isolation?.id ?? null;
  ctx.selectCanvasLayers(selected ? [selected.id] : [], selected?.id ?? null, {
    sync: false,
  });
  renderCanvasIsolationBreadcrumb(ctx);
  if (
    !selected ||
    !ctx.revealTimelineLayerById?.(selected.id, {
      focus: false,
      select: false,
    })
  ) {
    ctx.syncTimelineSelection(ctx.state.currentTemplate);
  }
}

function appendBreadcrumbButton(
  breadcrumb,
  label: string,
  activate: () => void,
): void {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.title = label;
  button.addEventListener("click", activate);
  breadcrumb.append(button);
}

function appendBreadcrumbSeparator(ctx: ViewerAppContext, breadcrumb): void {
  const separator = ctx.createViewerIcon("chevronRight");
  separator.classList.add("canvas-isolation-separator");
  breadcrumb.append(separator);
}

export function installCanvasIsolationBreadcrumbOwner(
  ctx: ViewerAppContext,
): void {
  ctx.getCanvasIsolationPath = (...args: any[]) =>
    (getCanvasIsolationPath as any)(ctx, ...args);
  ctx.renderCanvasIsolationBreadcrumb = (...args: any[]) =>
    (renderCanvasIsolationBreadcrumb as any)(ctx, ...args);
}
