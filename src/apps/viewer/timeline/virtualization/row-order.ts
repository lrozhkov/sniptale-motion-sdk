export type TimelineOrderedRow = {
  globalScope: boolean;
  kind: "layer" | "phase" | "scene" | "sceneTracks" | "track";
  layerId?: string;
  phaseId?: string;
  sceneId?: string;
  trackId?: string;
};

export type TimelineExpansionReader = {
  isRowExpanded: (type: string, id: string) => boolean;
  isSceneExpanded: (sceneId: string) => boolean;
};

export function flattenVisibleTimelineRows(
  tree,
  expansion: TimelineExpansionReader,
): TimelineOrderedRow[] {
  const rows: TimelineOrderedRow[] = [];
  appendLayerRows(rows, tree.globalLayers ?? [], null, true, expansion);
  for (const sceneRow of tree.scenes ?? []) {
    const sceneId = sceneRow.scene.id;
    rows.push({ globalScope: false, kind: "scene", sceneId });
    if (!expansion.isSceneExpanded(sceneId)) {
      continue;
    }
    appendLayerRows(rows, sceneRow.layers, sceneId, false, expansion);
    for (const phaseRow of sceneRow.scenePhases) {
      appendPhaseRow(rows, phaseRow, sceneId, false, "scenePhase", expansion);
    }
    if (sceneRow.sceneTracks.length > 0) {
      rows.push({ globalScope: false, kind: "sceneTracks", sceneId });
      if (expansion.isRowExpanded("sceneTracks", sceneId)) {
        appendTrackRows(rows, sceneRow.sceneTracks, sceneId, false);
      }
    }
  }
  return rows;
}

export function findTimelineLayerRowIndex(
  rows: TimelineOrderedRow[],
  target: {
    globalScope?: boolean;
    layerId: string;
    sceneId?: string | null;
  },
): number {
  return rows.findIndex(
    (row) =>
      row.kind === "layer" &&
      row.layerId === target.layerId &&
      row.globalScope === Boolean(target.globalScope) &&
      (row.globalScope || row.sceneId === target.sceneId),
  );
}

export function findTimelineItemRowIndex(
  rows: TimelineOrderedRow[],
  item: {
    keyframeId?: string;
    layerId?: string;
    phaseId?: string;
    sceneId?: string | null;
    trackId?: string;
    type?: string;
  },
): number {
  if (item.type === "scene") {
    return rows.findIndex(
      (row) => row.kind === "scene" && row.sceneId === item.sceneId,
    );
  }
  const kind =
    item.type === "phase"
      ? "phase"
      : item.type === "track" || item.type === "keyframe"
        ? "track"
        : item.type === "layer" || item.type === "clip"
          ? "layer"
          : null;
  if (!kind) {
    return -1;
  }
  const exact = rows.findIndex(
    (row) =>
      row.kind === kind &&
      rowMatchesItem(row, item) &&
      row.sceneId === (item.sceneId ?? undefined),
  );
  return exact >= 0
    ? exact
    : rows.findIndex((row) => row.kind === kind && rowMatchesItem(row, item));
}

function rowMatchesItem(row: TimelineOrderedRow, item): boolean {
  if (row.kind === "layer") {
    return row.layerId === item.layerId;
  }
  if (row.kind === "phase") {
    return row.phaseId === item.phaseId;
  }
  if (row.kind === "track") {
    return row.trackId === item.trackId;
  }
  return false;
}

function appendLayerRows(
  output: TimelineOrderedRow[],
  layerRows,
  sceneId: string | null,
  globalScope: boolean,
  expansion: TimelineExpansionReader,
): void {
  for (const row of layerRows) {
    output.push({
      globalScope,
      kind: "layer",
      layerId: row.layerId,
      sceneId: sceneId ?? undefined,
    });
    const rowType = row.kind === "group" ? "group" : "layer";
    if (!expansion.isRowExpanded(rowType, row.expansionId)) {
      continue;
    }
    if (row.kind === "group") {
      appendLayerRows(output, row.children, sceneId, globalScope, expansion);
      continue;
    }
    for (const phaseRow of row.phases) {
      appendPhaseRow(
        output,
        phaseRow,
        sceneId,
        globalScope,
        "phase",
        expansion,
      );
    }
    appendTrackRows(output, row.directTracks, sceneId, globalScope);
  }
}

function appendPhaseRow(
  output: TimelineOrderedRow[],
  phaseRow,
  sceneId: string | null,
  globalScope: boolean,
  expansionType: "phase" | "scenePhase",
  expansion: TimelineExpansionReader,
): void {
  output.push({
    globalScope,
    kind: "phase",
    phaseId: phaseRow.phase.id,
    sceneId: sceneId ?? undefined,
  });
  if (expansion.isRowExpanded(expansionType, phaseRow.expansionId)) {
    appendTrackRows(output, phaseRow.tracks, sceneId, globalScope);
  }
}

function appendTrackRows(
  output: TimelineOrderedRow[],
  trackRows,
  sceneId: string | null,
  globalScope: boolean,
): void {
  for (const row of trackRows) {
    output.push({
      globalScope,
      kind: "track",
      sceneId: sceneId ?? undefined,
      trackId: row.track.id,
    });
  }
}
