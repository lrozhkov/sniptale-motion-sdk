import type {
  TimelineOrderedRow,
  TimelineRowScope,
  TimelineOrderingTree,
  TimelineOrderingLayer,
  TimelineOrderingPhase,
  TimelineOrderingTrack,
  TimelineExpansionReader,
  TimelineLayerRowTarget,
  TimelineItemRowTarget,
} from "./row-order-model.js";
export function flattenVisibleTimelineRows(
  tree: TimelineOrderingTree,
  expansion: TimelineExpansionReader,
): TimelineOrderedRow[] {
  const rows: TimelineOrderedRow[] = [];
  appendLayerRows(
    rows,
    tree.globalLayers ?? [],
    { globalScope: true },
    expansion,
  );
  for (const sceneRow of tree.scenes ?? []) {
    const sceneId = sceneRow.scene.id;
    const scope: TimelineRowScope = { globalScope: false, sceneId };
    rows.push({ globalScope: false, kind: "scene", sceneId });
    if (!expansion.isSceneExpanded(sceneId)) {
      continue;
    }
    appendLayerRows(rows, sceneRow.layers, scope, expansion);
    for (const phaseRow of sceneRow.scenePhases) {
      appendPhaseRow(rows, phaseRow, scope, "scenePhase", expansion);
    }
    if (sceneRow.sceneTracks.length > 0) {
      rows.push({ globalScope: false, kind: "sceneTracks", sceneId });
      if (expansion.isRowExpanded("sceneTracks", sceneId)) {
        appendTrackRows(rows, sceneRow.sceneTracks, scope);
      }
    }
  }
  return rows;
}

export function findTimelineLayerRowIndex(
  rows: readonly TimelineOrderedRow[],
  target: TimelineLayerRowTarget,
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
  rows: readonly TimelineOrderedRow[],
  item: TimelineItemRowTarget,
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

function rowMatchesItem(
  row: TimelineOrderedRow,
  item: TimelineItemRowTarget,
): boolean {
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
  layerRows: readonly TimelineOrderingLayer[],
  scope: TimelineRowScope,
  expansion: TimelineExpansionReader,
): void {
  for (const row of layerRows) {
    output.push({
      ...scope,
      kind: "layer",
      layerId: row.layerId,
    });
    const rowType = row.kind === "group" ? "group" : "layer";
    if (!expansion.isRowExpanded(rowType, row.expansionId)) {
      continue;
    }
    if (row.kind === "group") {
      appendLayerRows(output, row.children, scope, expansion);
      continue;
    }
    for (const phaseRow of row.phases) {
      appendPhaseRow(output, phaseRow, scope, "phase", expansion);
    }
    appendTrackRows(output, row.directTracks, scope);
  }
}

function appendPhaseRow(
  output: TimelineOrderedRow[],
  phaseRow: TimelineOrderingPhase,
  scope: TimelineRowScope,
  expansionType: "phase" | "scenePhase",
  expansion: TimelineExpansionReader,
): void {
  output.push({
    ...scope,
    kind: "phase",
    phaseId: phaseRow.phase.id,
  });
  if (expansion.isRowExpanded(expansionType, phaseRow.expansionId)) {
    appendTrackRows(output, phaseRow.tracks, scope);
  }
}

function appendTrackRows(
  output: TimelineOrderedRow[],
  trackRows: readonly TimelineOrderingTrack[],
  scope: TimelineRowScope,
): void {
  for (const row of trackRows) {
    output.push({
      ...scope,
      kind: "track",
      trackId: row.track.id,
    });
  }
}
