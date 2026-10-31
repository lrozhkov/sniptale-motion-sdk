import type { TimelineOrderingTree } from "../src/apps/viewer/timeline/virtualization/row-order-model.js";
import { describe, expect, it } from "vitest";

import {
  findTimelineItemRowIndex,
  findTimelineLayerRowIndex,
  flattenVisibleTimelineRows,
} from "../src/apps/viewer/timeline/virtualization/row-order";
import {
  calculateTimelineVirtualWindow,
  shouldRefreshTimelineVirtualWindow,
} from "../src/apps/viewer/timeline/virtualization/window";

describe("viewer timeline virtualization", () => {
  it("keeps small timelines complete and windows large timelines", () => {
    expect(
      calculateTimelineVirtualWindow({
        rowCount: 30,
        rowHeight: 32,
        scrollTop: 0,
        viewportHeight: 256,
      }),
    ).toMatchObject({
      end: 30,
      start: 0,
      virtualized: false,
    });

    const window = calculateTimelineVirtualWindow({
      rowCount: 240,
      rowHeight: 32,
      scrollTop: 32 * 90,
      viewportHeight: 256,
    });
    expect(window).toMatchObject({
      end: 104,
      start: 84,
      virtualized: true,
      viewportRows: 8,
    });
    expect(shouldRefreshTimelineVirtualWindow(window, 32 * 91)).toBe(false);
    expect(shouldRefreshTimelineVirtualWindow(window, 32 * 101)).toBe(true);
  });

  it("flattens the expanded hierarchy in the same order as the renderer", () => {
    const expanded = new Set([
      "group:scene:group",
      "layer:scene:card",
      "phase:scene:card:build",
      "sceneTracks:scene",
    ]);
    const rows = flattenVisibleTimelineRows(createTree(), {
      isRowExpanded: (type, id) => expanded.has(`${type}:${id}`),
      isSceneExpanded: () => true,
    });

    expect(Object.hasOwn(rows[0] ?? {}, "sceneId")).toBe(false);
    expect(rows).toEqual([
      {
        globalScope: true,
        kind: "layer",
        layerId: "global-grid",
      },
      { globalScope: false, kind: "scene", sceneId: "scene" },
      {
        globalScope: false,
        kind: "layer",
        layerId: "group",
        sceneId: "scene",
      },
      {
        globalScope: false,
        kind: "layer",
        layerId: "card",
        sceneId: "scene",
      },
      {
        globalScope: false,
        kind: "phase",
        phaseId: "build",
        sceneId: "scene",
      },
      {
        globalScope: false,
        kind: "track",
        sceneId: "scene",
        trackId: "card.opacity",
      },
      {
        globalScope: false,
        kind: "track",
        sceneId: "scene",
        trackId: "card.x",
      },
      {
        globalScope: false,
        kind: "sceneTracks",
        sceneId: "scene",
      },
      {
        globalScope: false,
        kind: "track",
        sceneId: "scene",
        trackId: "scene.progress",
      },
    ]);
    expect(
      findTimelineLayerRowIndex(rows, {
        globalScope: false,
        layerId: "card",
        sceneId: "scene",
      }),
    ).toBe(3);
    expect(
      findTimelineLayerRowIndex(rows, {
        globalScope: true,
        layerId: "global-grid",
      }),
    ).toBe(0);
    expect(
      findTimelineItemRowIndex(rows, {
        sceneId: "scene",
        trackId: "card.opacity",
        type: "keyframe",
      }),
    ).toBe(5);
    expect(
      findTimelineItemRowIndex(rows, {
        phaseId: "build",
        sceneId: "scene",
        type: "phase",
      }),
    ).toBe(4);
  });
});

function createTree(): TimelineOrderingTree {
  const track = (id: string) => ({ track: { id } });
  return {
    globalLayers: [
      {
        directTracks: [],
        expansionId: "global:global-grid",
        kind: "layer",
        layerId: "global-grid",
        phases: [],
      },
    ],
    scenes: [
      {
        layers: [
          {
            children: [
              {
                directTracks: [track("card.x")],
                expansionId: "scene:card",
                kind: "layer",
                layerId: "card",
                phases: [
                  {
                    expansionId: "scene:card:build",
                    phase: { id: "build" },
                    tracks: [track("card.opacity")],
                  },
                ],
              },
            ],
            expansionId: "scene:group",
            kind: "group",
            layerId: "group",
          },
        ],
        scene: { id: "scene" },
        scenePhases: [],
        sceneTracks: [track("scene.progress")],
      },
    ],
  };
}
