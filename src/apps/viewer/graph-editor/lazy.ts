import type { ViewerAppContext } from "../app/context.js";
import type { GraphEditorActions, GraphRuntimeActions } from "./contract.js";
import type { EditorTimeline } from "../editor/model-types.js";

type GraphLazyRefs = {
  graphEditorButton: Pick<HTMLButtonElement, "disabled" | "setAttribute">;
  timelineEditor: { classList: Pick<DOMTokenList, "remove"> };
  curveEditor: Pick<HTMLElement, "hidden" | "replaceChildren">;
};
export type GraphLazyContext = {
  state: Pick<
    ViewerAppContext["state"],
    | "currentTemplate"
    | "graphEditorEnabled"
    | "graphEditorLinkedHandles"
    | "graphEditorViewport"
    | "selectedKeyframes"
  >;
  refs: GraphLazyRefs;
  deps: Pick<ViewerAppContext["deps"], "t">;
  logDiagnostic: ViewerAppContext["logDiagnostic"];
  getEffectiveTimeline: ViewerAppContext["getEffectiveTimeline"];
};

export function createLazyGraphEditorActions(
  getContext: () => GraphLazyContext,
  loadRuntime: () => Promise<GraphRuntimeActions>,
): GraphEditorActions {
  let runtime: GraphRuntimeActions | null = null;
  let pending: Promise<GraphRuntimeActions | null> | null = null;
  const ensureRuntime = (): Promise<GraphRuntimeActions | null> => {
    if (runtime) return Promise.resolve(runtime);
    pending ??= Promise.resolve()
      .then(loadRuntime)
      .then((actions) => {
        runtime = actions;
        return actions;
      })
      .catch(() => {
        pending = null;
        const ctx = getContext();
        ctx.state.graphEditorEnabled = false;
        ctx.logDiagnostic(
          ctx.deps.t(
            "viewer.graphEditor.loadFailed",
            "Could not load the graph editor. Try the action again.",
          ),
          "error",
        );
        return null;
      });
    return pending;
  };
  const renderFallback = (timeline: EditorTimeline): void => {
    const ctx = getContext();
    const selected = new Set(
      ctx.state.selectedKeyframes.map((ref) => ref.trackId),
    );
    const available = timeline.tracks.some(
      (track) =>
        selected.has(track.id) &&
        track.keyframes.length > 0 &&
        track.keyframes.every(
          (keyframe) =>
            typeof keyframe.value === "number" &&
            Number.isFinite(keyframe.value),
        ),
    );
    ctx.refs.graphEditorButton.disabled = !available;
    ctx.refs.graphEditorButton.setAttribute("aria-pressed", "false");
    ctx.refs.timelineEditor.classList.remove("graph-editor-active");
    ctx.refs.curveEditor.hidden = true;
    ctx.refs.curveEditor.replaceChildren();
  };
  const renderCurrent = (): void => {
    const ctx = getContext();
    const timeline = ctx.getEffectiveTimeline(ctx.state.currentTemplate);
    if (runtime) runtime.renderCurveEditor(timeline);
    else renderFallback(timeline);
  };
  return {
    renderCurveEditor(timeline) {
      if (runtime) {
        runtime.renderCurveEditor(timeline);
        return;
      }
      renderFallback(timeline);
      const ctx = getContext();
      if (
        ctx.state.graphEditorEnabled &&
        !ctx.refs.graphEditorButton.disabled
      ) {
        void ensureRuntime().then((actions) => {
          if (actions) renderCurrent();
        });
      }
    },
    async toggleGraphEditor(enabled = !getContext().state.graphEditorEnabled) {
      const ctx = getContext();
      ctx.state.graphEditorEnabled = enabled;
      if (runtime) {
        runtime.toggleGraphEditor(enabled);
        return;
      }
      renderCurrent();
      if (!enabled) return;
      const actions = await ensureRuntime();
      if (actions) actions.toggleGraphEditor(ctx.state.graphEditorEnabled);
    },
    async fitGraphEditor(mode) {
      if (runtime) return runtime.fitGraphEditor(mode);
      const ctx = getContext();
      const source = ctx.state.currentTemplate;
      const viewport = ctx.state.graphEditorViewport;
      const actions = await ensureRuntime();
      return actions &&
        source === ctx.state.currentTemplate &&
        viewport === ctx.state.graphEditorViewport
        ? actions.fitGraphEditor(mode)
        : false;
    },
    async zoomGraphEditor(factor, options) {
      if (runtime) return runtime.zoomGraphEditor(factor, options);
      const ctx = getContext();
      const source = ctx.state.currentTemplate;
      const viewport = ctx.state.graphEditorViewport;
      const actions = await ensureRuntime();
      return actions &&
        source === ctx.state.currentTemplate &&
        viewport === ctx.state.graphEditorViewport
        ? actions.zoomGraphEditor(factor, options)
        : false;
    },
    setGraphEditorViewport(viewport, options = {}) {
      if (runtime) runtime.setGraphEditorViewport(viewport, options);
      else {
        getContext().state.graphEditorViewport = viewport;
        if (options.render !== false) renderCurrent();
      }
    },
    setGraphEditorLinkedHandles(linked) {
      if (runtime) runtime.setGraphEditorLinkedHandles(linked);
      else getContext().state.graphEditorLinkedHandles = linked;
    },
    updateGraphEditorPlayhead(time) {
      runtime?.updateGraphEditorPlayhead(time);
    },
    handleGraphEditorWheel(event, model) {
      runtime?.handleGraphEditorWheel(event, model);
    },
    beginGraphEditorPan(event, model) {
      runtime?.beginGraphEditorPan(event, model);
    },
    beginGraphKeyframeDrag(event, model, trackId, keyframeId) {
      runtime?.beginGraphKeyframeDrag(event, model, trackId, keyframeId);
    },
    beginGraphBezierHandleDrag(event, model, trackId, keyframeId, handle) {
      runtime?.beginGraphBezierHandleDrag(
        event,
        model,
        trackId,
        keyframeId,
        handle,
      );
    },
    beginGraphSelectionScale(event, model, edge) {
      runtime?.beginGraphSelectionScale(event, model, edge);
    },
  };
}
