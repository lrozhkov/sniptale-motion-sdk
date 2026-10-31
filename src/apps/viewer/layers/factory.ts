import type { LayerOperationActions } from "./actions-contract.js";
const createUniqueLayerId: LayerOperationActions["createUniqueLayerId"] = (
  kind,
  layers,
) => {
  const ids = new Set(layers.map((layer) => layer.id));
  let index = 1;
  let id = `${kind}-${index}`;
  while (ids.has(id)) {
    index += 1;
    id = `${kind}-${index}`;
  }
  return id;
};
export function createLayerFactoryActions(): Pick<
  LayerOperationActions,
  "createUniqueLayerId"
> {
  return { createUniqueLayerId };
}
