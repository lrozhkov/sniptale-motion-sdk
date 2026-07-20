export type BindingReadType =
  | "clips"
  | "controls"
  | "inputFrames"
  | "layerGateReads"
  | "layers"
  | "primitivePaintReads"
  | "phases"
  | "tracks";

export interface PrimitivePaintBounds {
  height: number;
  layerId: string;
  width: number;
  x: number;
  y: number;
}

export type BindingReads = Record<BindingReadType, Set<string>> & {
  primitiveBounds: Map<string, PrimitivePaintBounds>;
};

type BindingReadScope = {
  dependencies: boolean;
  primitiveLayerId: string | null;
};

const bindingReadScopes = new WeakMap<BindingReads, BindingReadScope>();

export function createBindingReads(
  scope: Partial<BindingReadScope> = {},
): BindingReads {
  const reads: BindingReads = {
    clips: new Set(),
    controls: new Set(),
    inputFrames: new Set(),
    layerGateReads: new Set(),
    layers: new Set(),
    primitivePaintReads: new Set(),
    phases: new Set(),
    primitiveBounds: new Map(),
    tracks: new Set(),
  };
  bindingReadScopes.set(reads, {
    dependencies: scope.dependencies !== false,
    primitiveLayerId:
      typeof scope.primitiveLayerId === "string"
        ? scope.primitiveLayerId
        : null,
  });
  return reads;
}

export function createChildBindingReads(
  parent: BindingReads | null | undefined,
): BindingReads | null {
  if (!parent) {
    return null;
  }
  return createBindingReads(bindingReadScopes.get(parent));
}

export function recordBindingRead(
  reads: BindingReads | null | undefined,
  type: BindingReadType,
  id: unknown,
): void {
  if (
    !reads?.[type] ||
    bindingReadScopes.get(reads)?.dependencies === false ||
    id == null ||
    id === ""
  ) {
    return;
  }
  reads[type].add(String(id));
}

export function shouldRecordPrimitivePaintRead(
  reads: BindingReads | null | undefined,
  layerId: string,
): boolean {
  if (!reads) {
    return false;
  }
  const selectedLayerId = bindingReadScopes.get(reads)?.primitiveLayerId;
  return !selectedLayerId || selectedLayerId === layerId;
}

export function serializeBindingReads(context: any): Record<
  BindingReadType,
  string[]
> & {
  primitiveBounds: PrimitivePaintBounds[];
};
export function serializeBindingReads(
  context: any,
  options: { primitiveLayerId?: string; selectionOnly?: boolean },
): Record<BindingReadType, string[]> & {
  primitiveBounds: PrimitivePaintBounds[];
};
export function serializeBindingReads(
  context: any,
  options: { primitiveLayerId?: string; selectionOnly?: boolean } = {},
) {
  const reads = context?.__bindingReads ?? createBindingReads();
  if (options.selectionOnly) {
    const primitiveBounds = options.primitiveLayerId
      ? [reads.primitiveBounds.get(options.primitiveLayerId)].filter(Boolean)
      : [];
    return {
      clips: [],
      controls: [],
      inputFrames: [],
      layerGateReads: [],
      layers: [],
      primitiveBounds,
      primitivePaintReads: [],
      phases: [],
      tracks: [],
    };
  }
  return {
    clips: sortedStrings(reads.clips),
    controls: sortedStrings(reads.controls),
    inputFrames: sortedStrings(reads.inputFrames),
    layerGateReads: sortedStrings(reads.layerGateReads),
    layers: sortedStrings(reads.layers),
    primitiveBounds: Array.from(
      reads.primitiveBounds.values() as Iterable<PrimitivePaintBounds>,
    ).sort((a, b) => a.layerId.localeCompare(b.layerId)),
    primitivePaintReads: sortedStrings(reads.primitivePaintReads),
    phases: sortedStrings(reads.phases),
    tracks: sortedStrings(reads.tracks),
  };
}

export function serializeFrameBindingReads(
  context: any,
  options: { primitiveLayerId?: string; selectionOnly?: boolean } = {},
) {
  if (options.selectionOnly && !context?.__bindingReads) {
    return undefined;
  }
  return serializeBindingReads(context, options);
}

function sortedStrings(values: Iterable<unknown>): string[] {
  return Array.from(values, String).sort();
}
