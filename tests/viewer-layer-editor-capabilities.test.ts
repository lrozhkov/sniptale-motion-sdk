import { describe, expect, it } from "vitest";

import {
  canEditLayerProperty,
  canKeyframeLayerProperty,
  canPerformLayerOperation,
  canTransformLayerProperty,
  isRendererManagedCanvasCapabilities,
  isLayerCanvasSelectable,
  resolveLayerCanvasResizeProperty,
  resolveLayerEditorCapabilities,
} from "../src/apps/viewer/layers/editor-capabilities";
import { validateLayerEditorDefinition } from "../src/sdk/demo-pack-validator/templates";

describe("viewer layer editor capabilities", () => {
  it("keeps runtime-owned drawing layers selectable without fake transforms", () => {
    const layer = { id: "grid", opacity: 1, type: "customDraw" };

    expect(resolveLayerEditorCapabilities(layer)).toEqual({
      canvas: "fullFrame",
      keyframeProperties: ["opacity"],
      operations: ["delete"],
      properties: ["opacity"],
      transform: [],
    });
    expect(isLayerCanvasSelectable(layer)).toBe(true);
    expect(canEditLayerProperty(layer, "opacity")).toBe(true);
    expect(canEditLayerProperty(layer, "x")).toBe(false);
    expect(canPerformLayerOperation(layer, "duplicate")).toBe(false);
    expect(
      isRendererManagedCanvasCapabilities(
        resolveLayerEditorCapabilities(layer),
      ),
    ).toBe(true);
  });

  it("exposes audio volume without pretending audio is spatial", () => {
    const layer = { id: "sound", type: "audio", volume: 0.5 };

    expect(isLayerCanvasSelectable(layer)).toBe(false);
    expect(canEditLayerProperty(layer, "volume")).toBe(true);
    expect(canKeyframeLayerProperty(layer, "volume")).toBe(false);
    expect(canTransformLayerProperty(layer, "x")).toBe(false);
  });

  it("derives complete canvas editing for declarative visual layers", () => {
    const layer = { id: "card", type: "rect" };
    const capabilities = resolveLayerEditorCapabilities(layer);

    expect(capabilities.canvas).toBe("bounds");
    expect(capabilities.properties).toEqual(
      expect.arrayContaining(["fill", "width", "opacity", "rotation"]),
    );
    expect(canTransformLayerProperty(layer, "x")).toBe(true);
    expect(canKeyframeLayerProperty(layer, "rotation")).toBe(true);
    expect(resolveLayerCanvasResizeProperty(capabilities, "x")).toBe("width");
    expect(resolveLayerCanvasResizeProperty(capabilities, "y")).toBe("height");
    expect(isRendererManagedCanvasCapabilities(capabilities)).toBe(false);
  });

  it("uses declared dimensions before scale and requires positional ownership", () => {
    expect(
      resolveLayerCanvasResizeProperty(
        resolveLayerEditorCapabilities({
          editor: {
            canvas: "bounds",
            properties: ["x", "y", "width", "scaleX"],
            transform: ["x", "y", "scaleX"],
          },
          id: "wide",
          type: "customDraw",
        }),
        "x",
      ),
    ).toBe("width");
    expect(
      resolveLayerCanvasResizeProperty(
        resolveLayerEditorCapabilities({
          editor: {
            canvas: "bounds",
            properties: ["x", "width", "scaleX"],
            transform: ["x", "scaleX"],
          },
          id: "single-axis",
          type: "customDraw",
        }),
        "x",
      ),
    ).toBeNull();
    expect(
      resolveLayerCanvasResizeProperty(
        resolveLayerEditorCapabilities({
          editor: {
            canvas: "bounds",
            properties: ["scaleX"],
            transform: ["scaleX"],
          },
          id: "centered",
          type: "customDraw",
        }),
        "x",
      ),
    ).toBeNull();
  });

  it("honors an explicit runtime layer contract", () => {
    const layer = {
      editor: {
        canvas: "fullFrame",
        keyframeProperties: ["amount"],
        operations: ["duplicate"],
        properties: ["amount", "x"],
        transform: ["x"],
      },
      id: "effect",
      type: "customDraw",
    };

    expect(resolveLayerEditorCapabilities(layer)).toEqual({
      canvas: "fullFrame",
      keyframeProperties: ["amount"],
      operations: ["duplicate"],
      properties: ["amount", "x"],
      transform: ["x"],
    });
  });

  it("rejects malformed capability payloads at the template boundary", () => {
    const errors: Array<{ message: string; path: string }> = [];

    validateLayerEditorDefinition(
      {
        canvas: "somewhere",
        keyframeProperties: ["", 4],
        operations: ["clone"],
        properties: "opacity",
        transform: ["skew"],
      },
      "template.layers.0.editor",
      errors,
    );

    expect(errors.map((error) => error.path)).toEqual([
      "template.layers.0.editor.canvas",
      "template.layers.0.editor.transform.0",
      "template.layers.0.editor.operations.0",
      "template.layers.0.editor.properties",
      "template.layers.0.editor.keyframeProperties",
    ]);
  });
});
