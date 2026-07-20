import type { ViewerAppContext } from "../app/context.js";

function installLazyGraphEditorOwner(ctx: ViewerAppContext): void {
  let runtimePromise: Promise<void> | null = null;
  const ensureRuntime = async () => {
    runtimePromise ??= import("./install.js").then((module) => {
      module.installGraphEditorOwners(ctx);
    });
    await runtimePromise;
  };
  const renderFallback = (timeline) => {
    const available = canOpenGraphEditor(ctx, timeline);
    ctx.refs.graphEditorButton.disabled = !available;
    ctx.refs.graphEditorButton.setAttribute("aria-pressed", "false");
    ctx.refs.timelineEditor.classList.remove("graph-editor-active");
    ctx.refs.curveEditor.hidden = true;
    ctx.refs.curveEditor.replaceChildren();
    if (ctx.state.graphEditorEnabled && available) {
      void ensureRuntime().then(() =>
        ctx.renderCurveEditor(
          ctx.getEffectiveTimeline(ctx.state.currentTemplate),
        ),
      );
    }
  };
  ctx.renderCurveEditor = renderFallback;
  ctx.toggleGraphEditor = async (enabled = !ctx.state.graphEditorEnabled) => {
    if (!enabled && !runtimePromise) {
      ctx.state.graphEditorEnabled = false;
      renderFallback(ctx.getEffectiveTimeline(ctx.state.currentTemplate));
      return;
    }
    await ensureRuntime();
    return ctx.toggleGraphEditor(enabled);
  };
  ctx.fitGraphEditor = async (...args: any[]) => {
    await ensureRuntime();
    return ctx.fitGraphEditor(...args);
  };
  ctx.zoomGraphEditor = async (...args: any[]) => {
    await ensureRuntime();
    return ctx.zoomGraphEditor(...args);
  };
  ctx.setGraphEditorViewport = (viewport, options: any = {}) => {
    ctx.state.graphEditorViewport = viewport;
    if (options.render !== false) {
      renderFallback(ctx.getEffectiveTimeline(ctx.state.currentTemplate));
    }
  };
  ctx.setGraphEditorLinkedHandles = (linked) => {
    ctx.state.graphEditorLinkedHandles = Boolean(linked);
  };
}

function canOpenGraphEditor(ctx: ViewerAppContext, timeline): boolean {
  const trackIds = new Set(
    (ctx.state.selectedKeyframes ?? []).map((item) => item.trackId),
  );
  if (trackIds.size === 0) {
    return false;
  }
  return (timeline?.tracks ?? []).some(
    (track) =>
      trackIds.has(track.id) &&
      (track.keyframes ?? []).length > 0 &&
      track.keyframes.every((keyframe) => typeof keyframe.value === "number"),
  );
}

export { installLazyGraphEditorOwner };
