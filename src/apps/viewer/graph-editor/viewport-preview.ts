import type { EditorTimelineSource } from "../editor/timeline-source.js";
import type { GraphEditorViewport } from "./state.js";

type ViewportPreviewContext = {
  state: {
    currentTemplate: EditorTimelineSource | null;
    graphEditorEnabled: boolean;
    graphEditorPanSession: object | null;
    graphEditorViewport: GraphEditorViewport | null;
  };
  setGraphEditorViewport(viewport: GraphEditorViewport): void;
};

export function createGraphViewportPreview(
  ctx: ViewportPreviewContext,
  source: EditorTimelineSource,
) {
  const session = {};
  ctx.state.graphEditorPanSession = session;
  let expected = ctx.state.graphEditorViewport;
  let pending: GraphEditorViewport | null = null;
  let frame = 0;
  let finalized = false;
  const isCurrent = () =>
    ctx.state.graphEditorPanSession === session &&
    ctx.state.currentTemplate === source &&
    ctx.state.graphEditorEnabled &&
    ctx.state.graphEditorViewport === expected;
  const release = () => {
    if (ctx.state.graphEditorPanSession === session)
      ctx.state.graphEditorPanSession = null;
  };
  const discard = () => {
    finalized = true;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    pending = null;
    release();
  };
  const flush = () => {
    if (!isCurrent()) {
      discard();
      return;
    }
    if (pending) {
      const viewport = pending;
      pending = null;
      ctx.setGraphEditorViewport(viewport);
      expected = viewport;
    } else {
      pending = null;
    }
  };
  return {
    schedule(viewport: GraphEditorViewport) {
      if (finalized) return;
      if (!isCurrent()) {
        discard();
        return;
      }
      pending = viewport;
      if (!frame)
        frame = requestAnimationFrame(() => {
          if (finalized) return;
          frame = 0;
          flush();
        });
    },
    finalize() {
      if (finalized) return;
      finalized = true;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      try {
        flush();
      } finally {
        release();
      }
    },
  };
}
