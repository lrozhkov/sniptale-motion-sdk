import type { ViewerAppContext } from "../app/context.js";

function renderRendererBindingsPanel(
  ctx: ViewerAppContext,
  template = ctx.state.currentTemplate,
) {
  ctx.refs.rendererBindingsPanel.innerHTML = "";
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  if (!template || !effectiveTemplate) {
    ctx.refs.rendererBindingsPanel.textContent = ctx.deps.t(
      "viewer.renderer.noBindings",
      "No renderer bindings.",
    );
    ctx.syncHealthState();
    return;
  }
  const coverage = ctx.buildRendererBindingCoverage(effectiveTemplate);
  const summary = document.createElement("div");
  summary.className = `renderer-binding-summary${coverage.unboundCount > 0 ? " has-unbound" : ""}`;
  const label = document.createElement("strong");
  label.textContent = ctx.deps.t(
    "viewer.renderer.bindings",
    "Renderer bindings",
  );
  const meta = document.createElement("span");
  meta.textContent = ctx.deps
    .t(
      "viewer.renderer.coverage",
      "{bound}/{total} timeline items affect the current frame",
    )
    .replace("{bound}", String(coverage.boundCount))
    .replace("{total}", String(coverage.totalCount));
  summary.append(label, meta);
  ctx.refs.rendererBindingsPanel.append(summary);
  const list = document.createElement("div");
  list.className = "renderer-binding-list";
  for (const item of coverage.items.slice(0, 18)) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `renderer-binding-row ${item.bound ? "bound" : "unbound"}`;
    row.dataset.bindingType = item.type;
    row.dataset.targetId = item.id;
    const name = document.createElement("strong");
    name.textContent = item.label;
    const metaText = document.createElement("span");
    metaText.textContent = `${ctx.deps.t(
      `viewer.renderer.types.${item.type}`,
      item.type,
    )} · ${ctx.deps.t(
      item.bound
        ? "viewer.renderer.affectsCurrentFrame"
        : "viewer.renderer.notReadNow",
      item.bound ? "Affects current frame" : "Editable, not read now",
    )}`;
    row.title = `${item.label}\n${metaText.textContent}`;
    row.append(name, metaText);
    row.addEventListener("click", () => ctx.focusRendererBindingItem(item));
    list.append(row);
  }
  ctx.refs.rendererBindingsPanel.append(list);
  ctx.syncHealthState();
}

function buildRendererBindingCoverage(ctx: ViewerAppContext, template) {
  const reads = ctx.deps.normalizeBindingReads(ctx.state.lastBindingReads);
  const items = [
    ...(template.layers ?? []).map((layer) => ({
      bound: reads.layerGateReads.includes(layer.id),
      id: layer.id,
      label: layer.name || layer.id,
      sceneId: null,
      type: "layer",
    })),
    ...(template.clips ?? []).map((clip) => ({
      bound: reads.layerGateReads.includes(clip.layerId),
      id: clip.layerId,
      label: clip.layerId,
      sceneId: clip.sceneId ?? null,
      type: "clip",
    })),
    ...(template.timeline?.phases ?? []).map((phase) => ({
      bound: reads.phases.includes(phase.id),
      id: phase.id,
      label: phase.label || phase.id,
      sceneId: phase.sceneId ?? null,
      type: "phase",
    })),
    ...(template.timeline?.tracks ?? []).map((track) => ({
      bound: reads.tracks.includes(track.id),
      id: track.id,
      label: ctx.getTimelineTrackDisplayLabel(track),
      sceneId: track.sceneId ?? null,
      type: "track",
    })),
  ];
  const boundCount = items.filter((item) => item.bound).length;
  return {
    boundCount,
    items: [...items].sort(
      (a, b) =>
        Number(a.bound) - Number(b.bound) ||
        a.type.localeCompare(b.type) ||
        a.label.localeCompare(b.label),
    ),
    totalCount: items.length,
    unboundCount: items.length - boundCount,
  };
}

function focusRendererBindingItem(ctx: ViewerAppContext, item) {
  if (!ctx.state.currentTemplate) {
    return;
  }
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  const sceneId =
    item.sceneId ?? ctx.findRendererBindingSceneId(template, item);
  if (sceneId) {
    ctx.state.expandedSceneIds.add(sceneId);
  }
  if (item.type === "layer") {
    ctx.focusLayer(item.id);
    ctx.scrollTimelineTargetIntoView(
      `.timeline-lane.layer-lane[data-layer-id="${ctx.cssEscape(item.id)}"]`,
    );
    return;
  }
  if (item.type === "clip") {
    ctx.selectClipBlock(item.id);
    ctx.renderTimelineEditor(ctx.state.currentTemplate);
    ctx.scrollTimelineTargetIntoView(
      `.clip-block[data-layer-id="${ctx.cssEscape(item.id)}"]`,
    );
    return;
  }
  if (item.type === "phase") {
    ctx.selectPhaseBlock(item.id);
    ctx.renderTimelineEditor(ctx.state.currentTemplate);
    ctx.scrollTimelineTargetIntoView(
      `.phase-block[data-phase-id="${ctx.cssEscape(item.id)}"]`,
    );
    return;
  }
  if (item.type === "track") {
    ctx.selectTrackLane(item.id);
    ctx.renderTimelineEditor(ctx.state.currentTemplate);
    ctx.scrollTimelineTargetIntoView(
      `.timeline-lane[data-track-id="${ctx.cssEscape(item.id)}"]`,
    );
  }
}

function findRendererBindingSceneId(ctx: ViewerAppContext, template, item) {
  if (!template) {
    return null;
  }
  if (item.type === "phase") {
    return (
      template.timeline?.phases?.find((phase) => phase.id === item.id)
        ?.sceneId ?? null
    );
  }
  const track = template.timeline?.tracks?.find(
    (entry) => entry.id === item.id,
  );
  if (track?.sceneId) {
    return track.sceneId;
  }
  const keyframeScene = track?.keyframes?.find(
    (keyframe) => keyframe.sceneId,
  )?.sceneId;
  return keyframeScene ?? null;
}

export function installInspectorRendererBindingsOwner(
  ctx: ViewerAppContext,
): void {
  ctx.renderRendererBindingsPanel = (...args: any[]) =>
    (renderRendererBindingsPanel as any)(ctx, ...args);
  ctx.buildRendererBindingCoverage = (...args: any[]) =>
    (buildRendererBindingCoverage as any)(ctx, ...args);
  ctx.focusRendererBindingItem = (...args: any[]) =>
    (focusRendererBindingItem as any)(ctx, ...args);
  ctx.findRendererBindingSceneId = (...args: any[]) =>
    (findRendererBindingSceneId as any)(ctx, ...args);
}
