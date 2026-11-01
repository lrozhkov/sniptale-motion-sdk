import type { EffectLayer } from "../src/sdk/types.js";
import { describe, expect, it } from "vitest";

import {
  MAX_LAYER_GROUP_DEPTH,
  createLayerHierarchyIndex,
  getLayerLeafIds,
  getLayerSubtreeIds,
  hasLayerHierarchyCycle,
  normalizeLayerSelectionRoots,
} from "../src/apps/viewer/layers/hierarchy";
import {
  canGroupLayerSelection,
  createUniqueLayerGroupId,
  groupLayerSelection,
  removeLayerSubtrees,
  ungroupLayerSelection,
} from "../src/apps/viewer/layers/hierarchy-operations";
import { reparentLayerSelection } from "../src/apps/viewer/layers/reparent";
import { createLayerSiblingMove } from "../src/apps/viewer/layers/order";
import { collectEditorValidationErrors } from "../src/apps/viewer/validation/model";

describe("viewer layer hierarchy", () => {
  it("groups contiguous siblings without changing leaf render order", () => {
    const layers = [
      layer("background"),
      layer("card"),
      layer("title"),
      layer("logo"),
    ];
    expect(canGroupLayerSelection(layers, ["card", "title"])).toMatchObject({
      ok: true,
      orderedRootIds: ["card", "title"],
      parentId: null,
      startIndex: 1,
    });

    const grouped = groupLayerSelection(layers, ["title", "card"], {
      id: "group-1",
      name: "Group 1",
      type: "group",
    });
    expect(grouped.map((entry) => entry.id)).toEqual([
      "background",
      "group-1",
      "card",
      "title",
      "logo",
    ]);
    expect(grouped.find((entry) => entry.id === "card")?.parentId).toBe(
      "group-1",
    );
    expect(
      getLayerLeafIds(createLayerHierarchyIndex(grouped), ["group-1"]),
    ).toEqual(["card", "title"]);
  });

  it("rejects non-contiguous roots and selections with different parents", () => {
    const layers = [
      layer("background"),
      group("group-1"),
      layer("card", "group-1"),
      layer("title", "group-1"),
      layer("logo"),
    ];
    expect(canGroupLayerSelection(layers, ["background", "logo"])).toEqual({
      ok: false,
      reason: "non-contiguous",
    });
    expect(canGroupLayerSelection(layers, ["card", "logo"])).toEqual({
      ok: false,
      reason: "different-parents",
    });
    expect(
      normalizeLayerSelectionRoots(createLayerHierarchyIndex(layers), [
        "group-1",
        "card",
      ]),
    ).toEqual(["group-1"]);
  });

  it("ungroups and removes complete subtrees", () => {
    const layers = [
      group("outer"),
      group("inner", "outer"),
      layer("card", "inner"),
      layer("title", "outer"),
      layer("logo"),
    ];
    const ungrouped = ungroupLayerSelection(layers, ["inner"]);
    expect(ungrouped.map((entry) => entry.id)).toEqual([
      "outer",
      "card",
      "title",
      "logo",
    ]);
    expect(ungrouped.find((entry) => entry.id === "card")?.parentId).toBe(
      "outer",
    );

    const removed = removeLayerSubtrees(layers, ["outer"]);
    expect(removed.removedIds).toEqual(["outer", "inner", "card", "title"]);
    expect(removed.layers.map((entry) => entry.id)).toEqual(["logo"]);
  });

  it("detects cycles, excessive depth, and split subtrees", () => {
    const cyclic = [group("a", "b"), group("b", "a")];
    const cyclicIndex = createLayerHierarchyIndex(cyclic);
    expect(hasLayerHierarchyCycle(cyclicIndex, "a")).toBe(true);
    expect(collectEditorValidationErrors(template(cyclic))).toEqual(
      expect.arrayContaining([
        'Layer hierarchy contains a cycle at "a"',
        'Layer hierarchy contains a cycle at "b"',
      ]),
    );

    const deep = Array.from(
      { length: MAX_LAYER_GROUP_DEPTH + 2 },
      (_, index) =>
        index === MAX_LAYER_GROUP_DEPTH + 1
          ? layer(`leaf-${index}`, `group-${index - 1}`)
          : group(`group-${index}`, index > 0 ? `group-${index - 1}` : null),
    );
    expect(collectEditorValidationErrors(template(deep)).join("\n")).toContain(
      `exceeds maximum group depth ${MAX_LAYER_GROUP_DEPTH}`,
    );

    const split = [
      group("group-1"),
      layer("card", "group-1"),
      layer("outside"),
      layer("title", "group-1"),
    ];
    expect(collectEditorValidationErrors(template(split))).toContain(
      'Group "group-1" has a non-contiguous layer subtree',
    );
  });

  it("validates group ownership and creates stable ids", () => {
    const layers = [
      layer("card"),
      layer("title", "card"),
      group("group-1"),
      layer("logo", "group-1"),
    ];
    const errors = collectEditorValidationErrors({
      ...template(layers),
      clips: [{ duration: 2, layerId: "group-1", start: 0 }],
      timeline: {
        phases: [],
        tracks: [
          {
            id: "group-1.x",
            keyframes: [],
            layerId: "group-1",
            target: "group-1",
          },
        ],
      },
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        'Layer "title" references non-group parent "card"',
        'Group "group-1" cannot own a clip',
        'Group "group-1" cannot own animation track "group-1.x"',
      ]),
    );
    expect(createUniqueLayerGroupId(layers)).toBe("group-2");
    expect(
      getLayerSubtreeIds(createLayerHierarchyIndex(layers), "group-1"),
    ).toEqual(["group-1", "logo"]);
  });

  it("reparents complete subtrees using visual before/inside/after positions", () => {
    const layers = [
      group("group-a"),
      layer("card", "group-a"),
      layer("title", "group-a"),
      group("group-b"),
      layer("logo", "group-b"),
      layer("footer"),
    ];

    const inside = reparentLayerSelection(
      layers,
      ["title"],
      "group-b",
      "inside",
    );
    expect(inside).toMatchObject({ ok: true, parentId: "group-b" });
    if (!inside.ok) throw new Error("Expected successful subtree reparenting.");
    expect(inside.layers.map((entry) => entry.id)).toEqual([
      "group-a",
      "card",
      "group-b",
      "logo",
      "title",
      "footer",
    ]);
    expect(inside.layers.find((entry) => entry.id === "title")?.parentId).toBe(
      "group-b",
    );

    const aboveFooter = reparentLayerSelection(
      layers,
      ["group-a"],
      "footer",
      "before",
    );
    expect(
      aboveFooter.ok && aboveFooter.layers.map((entry) => entry.id),
    ).toEqual(["group-b", "logo", "footer", "group-a", "card", "title"]);
    expect(
      reparentLayerSelection(layers, ["group-a"], "card", "inside"),
    ).toEqual({ ok: false, reason: "cycle" });
  });

  it("reorders sibling subtrees without splitting nested groups", () => {
    const layers = [
      group("group-a"),
      layer("card", "group-a"),
      layer("title", "group-a"),
      layer("logo"),
      layer("footer"),
    ];

    expect(
      createLayerSiblingMove(layers, ["group-a"], -1)?.map((entry) => entry.id),
    ).toEqual(["logo", "group-a", "card", "title", "footer"]);
    expect(
      createLayerSiblingMove(layers, ["card"], -1)?.map((entry) => entry.id),
    ).toEqual(["group-a", "title", "card", "logo", "footer"]);
    expect(createLayerSiblingMove(layers, ["card"], 1)).toBeNull();
  });
});

function layer(id: string, parentId: string | null = null) {
  return { id, name: id, parentId, type: "rect" };
}

function group(id: string, parentId: string | null = null) {
  return { id, name: id, parentId, type: "group" };
}

function template(layers: EffectLayer[]) {
  return {
    clips: [],
    duration: 2,
    kind: "composition",
    layers,
    scenes: [{ duration: 2, id: "main", start: 0 }],
    timeline: { phases: [], tracks: [] },
  };
}
