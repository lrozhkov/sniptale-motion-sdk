import type { ViewerAppContext } from "../app/context.js";

export function readCanvasSelectionViewport(
  ctx: ViewerAppContext,
  useCached: boolean,
) {
  if (useCached && ctx.state.canvasSelectionViewport) {
    return ctx.state.canvasSelectionViewport;
  }
  const canvasRect = snapshotRect(ctx.refs.canvas.getBoundingClientRect());
  const stageRect = snapshotRect(
    ctx.refs.canvas.parentElement.getBoundingClientRect(),
  );
  const viewport = { canvasRect, stageRect };
  ctx.state.canvasSelectionViewport = viewport;
  return viewport;
}

export function scheduleCanvasSelectionPlaybackUpdate(
  ctx: ViewerAppContext,
): void {
  if (ctx.canvasSelectionPlaybackFrame) {
    return;
  }
  ctx.canvasSelectionPlaybackFrame = requestAnimationFrame(() => {
    ctx.canvasSelectionPlaybackFrame = 0;
    if (ctx.state.playing) {
      ctx.updateCanvasSelectionBox({ playbackFrame: true });
    }
  });
}

export function observeCanvasSelectionViewport(ctx: ViewerAppContext): void {
  let frame = 0;
  const sync = () => {
    if (frame) {
      return;
    }
    frame = requestAnimationFrame(() => {
      frame = 0;
      ctx.updateCanvasSelectionBox();
    });
  };
  const observer = new ResizeObserver(sync);
  observer.observe(ctx.refs.canvas);
  window.addEventListener("resize", sync);
  ctx.refs.stageWrap.addEventListener("scroll", sync, { passive: true });
}

function snapshotRect(rect: DOMRect) {
  return {
    bottom: rect.bottom,
    height: rect.height,
    left: rect.left,
    right: rect.right,
    top: rect.top,
    width: rect.width,
  };
}
