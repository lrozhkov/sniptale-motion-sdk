import { renderCurrentFrame } from "../rendering/service.js";
import { getSelectedKeyframeRefs } from "../timeline/interaction/keyframes.js";
import { resolveRenderTemplateSnapshot } from "../rendering/model-cache.js";
import { createViewerRefs } from "./refs.js";
import { createViewerState } from "./state.js";
import { viewerAppDependencies } from "./dependencies.js";
import type { ViewerAppContext } from "./context.js";
import { getEffectiveTemplate } from "../templates/controller.js";
import {
  getEffectiveTimeline,
  getEditorOverride,
  setEditorOverride,
  getEffectiveDuration,
} from "../editor/store.js";

export function createViewerContext(): ViewerAppContext {
  const refs = createViewerRefs();
  const previewContext = refs.canvas.getContext("2d");
  if (!previewContext)
    throw new Error("Viewer Canvas 2D context is unavailable.");
  const ctx: ViewerAppContext = {
    deps: viewerAppDependencies,
    state: createViewerState(),
    refs,
    previewContext,
    lastPlaybackAudioTs: 0,
    playbackAnimationFrame: null,
    playbackRenderTimer: null,
    lastPlaybackRenderTs: 0,
    lastPlaybackTs: 0,
    lastPlaybackUiTs: 0,
    renderCurrentFrame(options) {
      return renderCurrentFrame(ctx, options);
    },
    getSelectedKeyframeRefs() {
      return getSelectedKeyframeRefs(ctx);
    },
    getEditorOverride(template) {
      return getEditorOverride(ctx, template);
    },
    setEditorOverride(patch) {
      setEditorOverride(ctx, patch);
    },
    getEffectiveDuration(template) {
      return getEffectiveDuration(ctx, template);
    },
    getEffectiveTemplate(template) {
      return getEffectiveTemplate(ctx, template);
    },
    getRenderTemplateSnapshot(template) {
      return resolveRenderTemplateSnapshot(ctx, template);
    },
    getEffectiveTimeline(template) {
      return getEffectiveTimeline(ctx, template);
    },
  };
  return ctx;
}
