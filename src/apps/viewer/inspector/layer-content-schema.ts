const DEFAULT_FILL = "rgba(255,255,255,0.12)";
const DEFAULT_STROKE = "rgba(255,255,255,0.72)";

const COMMON_FIELDS = [
  {
    defaultValue: "source-over",
    kind: "select",
    label: "Blend",
    options: ["source-over", "lighter", "screen", "multiply", "overlay"],
    property: "blendMode",
  },
  numberField("Width", "width", 240, 8, 4000, 1),
  numberField("Height", "height", 120, 8, 4000, 1),
];

const STROKE_FIELD = colorField("Stroke", "stroke", DEFAULT_STROKE);
const STROKE_WIDTH_FIELD = numberField(
  "Stroke",
  "strokeWidth",
  1,
  0.5,
  40,
  0.5,
);
const TRIM_FIELDS = [
  numberField("Trim start", "trimStart", 0, 0, 1, 0.01),
  numberField("Trim end", "trimEnd", 1, 0, 1, 0.01),
];

export function getLayerContentFields(layer) {
  if (layer.type === "text") {
    return [
      textField("Text", "text", ""),
      colorField("Color", "color", "#f6fbff"),
      textField("Font family", "fontFamily", "Arial"),
      numberField("Font size", "fontSize", 48, 6, 360, 1),
      ...COMMON_FIELDS,
    ];
  }
  if (layer.type === "rect" || layer.type === "ellipse") {
    return [
      colorField("Fill", "fill", DEFAULT_FILL),
      STROKE_FIELD,
      {
        ...STROKE_WIDTH_FIELD,
        min: 0,
      },
      ...(layer.type === "rect"
        ? [numberField("Radius", "radius", 0, 0, 240, 1)]
        : []),
      ...COMMON_FIELDS,
    ];
  }
  if (layer.type === "line") {
    return [STROKE_FIELD, STROKE_WIDTH_FIELD, ...TRIM_FIELDS, ...COMMON_FIELDS];
  }
  if (layer.type === "path") {
    return [
      STROKE_FIELD,
      colorField("Fill", "fill", DEFAULT_FILL),
      STROKE_WIDTH_FIELD,
      ...TRIM_FIELDS,
      {
        defaultValue: false,
        kind: "boolean",
        label: "Closed",
        property: "pathClosed",
      },
      ...COMMON_FIELDS,
    ];
  }
  if (layer.type === "svgAsset") {
    return [
      {
        ...selectField(
          "SVG parts",
          "svgPartMode",
          "none",
          "none",
          "reveal",
          "scatter",
        ),
        refreshInspector: true,
      },
      selectField(
        "Part order",
        "partOrder",
        "document",
        "document",
        "reverse",
        "center",
        "edges",
        "random",
      ),
      numberField("Part reveal", "partReveal", 1, 0, 1, 0.01),
      numberField("Part stagger", "partStagger", 0, 0, 0.4, 0.01),
      numberField("Part spread", "partSpread", 0, 0, 240, 1),
      numberField("Part blur", "partBlur", 0, 0, 16, 0.1),
      textField("Part ids", "svgPartIds", ""),
      ...COMMON_FIELDS,
    ];
  }
  if (layer.type === "imageAsset") {
    return [...COMMON_FIELDS];
  }
  if (layer.type === "audio") {
    return [numberField("Volume", "volume", 1, 0, 1, 0.01)];
  }
  return [];
}

function colorField(label, property, defaultValue) {
  return { defaultValue, kind: "color", label, property };
}

function numberField(label, property, defaultValue, min, max, step) {
  return { defaultValue, kind: "number", label, max, min, property, step };
}

function selectField(label, property, defaultValue, ...options) {
  return { defaultValue, kind: "select", label, options, property };
}

function textField(label, property, defaultValue) {
  return { defaultValue, kind: "text", label, property };
}
