import { describe, expect, it } from "vitest";

import { normalizeLayers } from "../src/apps/sandbox/runtime/render-normalization";
import { partitionLayerContentFields } from "../src/apps/viewer/inspector/layer-properties";
import { getLayerContentFields } from "../src/apps/viewer/inspector/layer-content-schema";
import { setLocale, t } from "../src/shared/i18n";

describe("viewer inspector property layout", () => {
  it("keeps primary appearance separate from size and advanced controls", () => {
    const plan = partitionLayerContentFields([
      { property: "fill" },
      { property: "stroke" },
      { property: "blendMode" },
      { property: "width" },
      { property: "height" },
      { property: "svgPartMode" },
      { property: "partOrder" },
      { property: "svgPartIds" },
    ]);

    expect(properties(plan.primary)).toEqual(["fill", "stroke"]);
    expect(properties(plan.size)).toEqual(["width", "height"]);
    expect(properties(plan.advanced)).toEqual(["blendMode"]);
    expect(properties(plan.svgParts)).toEqual([
      "svgPartMode",
      "partOrder",
      "svgPartIds",
    ]);
  });

  it("refreshes the inspector when SVG animation controls become relevant", () => {
    const mode = getLayerContentFields({ type: "svgAsset" }).find(
      (field) => field.property === "svgPartMode",
    );

    expect(mode).toMatchObject({
      defaultValue: "none",
      refreshInspector: true,
    });
  });

  it("shows renderer defaults instead of empty editable values", () => {
    const fields = getLayerContentFields({ type: "rect" });
    const defaults = Object.fromEntries(
      fields.map((field) => [field.property, field.defaultValue]),
    );

    expect(defaults).toMatchObject({
      blendMode: "source-over",
      fill: "rgba(255,255,255,0.12)",
      height: 120,
      radius: 0,
      stroke: "rgba(255,255,255,0.72)",
      strokeWidth: 1,
      width: 240,
    });
    const runtimeLayer = normalizeLayers([{ id: "rect", type: "rect" }])[0];
    for (const property of [
      "blendMode",
      "fill",
      "height",
      "radius",
      "stroke",
      "strokeWidth",
      "width",
    ] as const) {
      expect(defaults[property]).toBe(runtimeLayer[property]);
    }
  });

  it("localizes every technical value exposed by layer select fields", () => {
    const selectFields = [
      ...getLayerContentFields({ type: "rect" }),
      ...getLayerContentFields({ type: "svgAsset" }),
    ].filter((field) => field.kind === "select");

    try {
      for (const locale of ["ru", "en"] as const) {
        setLocale(locale);
        for (const field of selectFields) {
          const options =
            "options" in field && Array.isArray(field.options)
              ? field.options
              : [];
          for (const value of options) {
            const key = `viewer.inspector.layerOptions.${field.property}.${value}`;
            expect(t(key, key), `${locale}: ${key}`).not.toBe(key);
          }
        }
      }
    } finally {
      setLocale("ru");
    }
  });
});

function properties(fields: readonly { property: string }[]): string[] {
  return fields.map((field) => field.property);
}
