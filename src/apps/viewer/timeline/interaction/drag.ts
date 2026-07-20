import type { ViewerAppContext } from "../../app/context.js";

function rectsIntersect(ctx: ViewerAppContext, a, b) {
  return (
    a.left <= b.right &&
    a.right >= b.left &&
    a.top <= b.bottom &&
    a.bottom >= b.top
  );
}

function rectContainsRectCenter(ctx: ViewerAppContext, a, b) {
  const centerX = b.left + b.width / 2;
  const centerY = b.top + b.height / 2;
  return (
    centerX >= a.left &&
    centerX <= a.right &&
    centerY >= a.top &&
    centerY <= a.bottom
  );
}

export function installInteractionDragOwner(ctx: ViewerAppContext): void {
  ctx.rectsIntersect = (...args: any[]) =>
    (rectsIntersect as any)(ctx, ...args);
  ctx.rectContainsRectCenter = (...args: any[]) =>
    (rectContainsRectCenter as any)(ctx, ...args);
}
