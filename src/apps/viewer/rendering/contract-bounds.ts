export function mergePrimitiveBounds(current = [], next = []) {
  const byLayer = new Map();
  for (const bounds of [...current, ...next]) {
    if (!bounds?.layerId) {
      continue;
    }
    const previous = byLayer.get(bounds.layerId);
    byLayer.set(
      bounds.layerId,
      previous ? unionPrimitiveBounds(previous, bounds) : bounds,
    );
  }
  return Array.from(byLayer.values()).sort((a, b) =>
    a.layerId.localeCompare(b.layerId),
  );
}

function unionPrimitiveBounds(a, b) {
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
