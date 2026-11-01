type PrimitiveBounds = {
  layerId: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
export function unionPrimitiveBounds(
  a: PrimitiveBounds,
  b: PrimitiveBounds,
): PrimitiveBounds {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return {
    height: bottom - y,
    layerId: a.layerId,
    width: right - x,
    x,
    y,
  };
}
