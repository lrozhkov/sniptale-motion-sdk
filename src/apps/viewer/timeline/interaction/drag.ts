import type { TimelineRect } from "./pointer-contract.js";

export function rectsIntersect(a: TimelineRect, b: TimelineRect): boolean {
  return (
    a.left <= b.right &&
    a.right >= b.left &&
    a.top <= b.bottom &&
    a.bottom >= b.top
  );
}

export function rectContainsRectCenter(
  a: TimelineRect,
  b: Pick<DOMRectReadOnly, "left" | "top" | "width" | "height">,
): boolean {
  const centerX = b.left + b.width / 2;
  const centerY = b.top + b.height / 2;
  return (
    centerX >= a.left &&
    centerX <= a.right &&
    centerY >= a.top &&
    centerY <= a.bottom
  );
}
