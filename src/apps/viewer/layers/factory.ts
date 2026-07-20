import type { ViewerAppContext } from "../app/context.js";

function createUniqueLayerId(ctx: ViewerAppContext, kind, layers) {
  const ids = new Set(layers.map((layer) => layer.id));
  let index = 1;
  let id = `${kind}-${index}`;
  while (ids.has(id)) {
    index += 1;
    id = `${kind}-${index}`;
  }
  return id;
}

export function installLayersFactoryOwner(ctx: ViewerAppContext): void {
  ctx.createUniqueLayerId = (...args: any[]) =>
    (createUniqueLayerId as any)(ctx, ...args);
}
