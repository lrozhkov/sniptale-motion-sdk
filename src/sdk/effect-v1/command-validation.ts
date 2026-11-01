import { diagnosticValue } from "../diagnostic-value.js";
import { formatEffectV1DiagnosticValue } from "./diagnostics.js";
import { isUnknownArray } from "./validation-shared.js";
import type { EffectV1ValidationErrorReport } from "./diagnostics.js";
import { isRecord, rejectUnknownKeys } from "./validation-shared.js";

const REQUIRED_FIELDS: Record<string, readonly string[]> = {
  clip: ["commands", "height", "width", "x", "y"],
  compositePass: ["passId"],
  fillRect: ["fill", "height", "width", "x", "y"],
  forEach: ["commands", "items"],
  forGrid: ["columns", "commands", "rows"],
  forRange: ["commands", "count"],
  group: ["commands"],
  image: ["height", "width", "x", "y"],
  let: ["bindings", "commands"],
  path: [],
  polyline: ["points", "stroke"],
  renderPass: ["commands", "id"],
  sampledPath: ["from", "samples", "stroke", "to", "x", "y"],
  shape: ["height", "shape", "width", "x", "y"],
  stableOrderBy: ["commands", "items", "key"],
  svgParts: ["assetId", "height", "width", "x", "y"],
  text: ["text", "x", "y"],
  when: ["commands", "condition"],
};

const NUMERIC_FIELDS = new Set([
  "alpha",
  "fontSize",
  "from",
  "height",
  "lineWidth",
  "maxWidth",
  "progress",
  "radius",
  "reveal",
  "rotation",
  "scaleX",
  "scaleY",
  "to",
  "width",
  "x",
  "y",
]);
const ENUM_FIELDS: Record<string, ReadonlySet<string>> = {
  align: new Set(["center", "end", "left", "right", "start"]),
  baseline: new Set([
    "alphabetic",
    "bottom",
    "hanging",
    "ideographic",
    "middle",
    "top",
  ]),
  blend: new Set([
    "lighter",
    "screen",
    "source-over",
    "source-atop",
    "destination-in",
  ]),
  direction: new Set(["asc", "desc"]),
  fit: new Set(["contain", "cover", "fill"]),
  fontStyle: new Set(["italic", "normal", "oblique"]),
  lineCap: new Set(["butt", "round", "square"]),
  lineJoin: new Set(["bevel", "miter", "round"]),
  shape: new Set(["circle", "diamond", "ellipse", "rect", "roundRect"]),
};
const FILTER_KEYS = new Set(["blur", "brightness", "saturate"]);
const SHADOW_KEYS = new Set(["blur", "color", "x", "y"]);
const LINEAR_GRADIENT_KEYS = new Set(["kind", "stops", "x0", "x1", "y0", "y1"]);
const RADIAL_GRADIENT_KEYS = new Set([...LINEAR_GRADIENT_KEYS, "r0", "r1"]);
const GRADIENT_STOP_KEYS = new Set(["color", "offset"]);

export type EffectV1PassIndex = {
  duplicateIds: Set<string>;
  ids: Set<string>;
};

export function collectEffectV1PassIndex(
  commands: unknown[],
): EffectV1PassIndex {
  const ids = new Set<string>();
  const duplicateIds = new Set<string>();
  walkCommands(commands, (command) => {
    if (command.op !== "renderPass" || typeof command.id !== "string") return;
    if (ids.has(command.id)) duplicateIds.add(command.id);
    ids.add(command.id);
  });
  return { duplicateIds, ids };
}

export function validateEffectV1CommandSemantics(
  command: Record<string, unknown>,
  path: string,
  passes: EffectV1PassIndex,
  report: EffectV1ValidationErrorReport,
): void {
  const requiredFields =
    typeof command.op === "string" && Object.hasOwn(REQUIRED_FIELDS, command.op)
      ? REQUIRED_FIELDS[command.op]
      : [];
  for (const field of requiredFields ?? []) {
    if (command[field] === undefined) {
      report.error(
        "COMMAND_FIELD_REQUIRED",
        `${path}.${field}`,
        `Command "${diagnosticValue(command.op)}" requires field "${field}".`,
      );
    }
  }

  for (const field of NUMERIC_FIELDS) {
    if (command[field] !== undefined) {
      validateNumericExpression(command[field], `${path}.${field}`, report);
    }
  }
  for (const [field, values] of Object.entries(ENUM_FIELDS)) {
    const value = command[field];
    if (
      value !== undefined &&
      (typeof value !== "string" || !values.has(value))
    ) {
      report.error(
        "COMMAND_ENUM",
        `${path}.${field}`,
        `Unsupported ${field} value "${formatEffectV1DiagnosticValue(command[field])}".`,
        `Use one of: ${[...values].join(", ")}.`,
      );
    }
  }
  if (command.caret !== undefined && typeof command.caret !== "boolean") {
    report.error("COMMAND_BOOLEAN", `${path}.caret`, "Expected a boolean.");
  }
  if (command.op === "forRange") {
    validateStaticLoopField(command.count, `${path}.count`, report);
  }
  if (command.op === "forGrid") {
    validateStaticLoopField(command.columns, `${path}.columns`, report);
    validateStaticLoopField(command.rows, `${path}.rows`, report);
  }
  if (command.op === "sampledPath") {
    if (
      typeof command.samples !== "number" ||
      !Number.isSafeInteger(command.samples) ||
      command.samples < 2 ||
      command.samples > 256
    ) {
      report.error(
        "SAMPLED_PATH_BOUND",
        `${path}.samples`,
        "Sampled path requires a static sample count from 2 to 256.",
      );
    }
    if (
      command.sampleVar !== undefined &&
      (typeof command.sampleVar !== "string" ||
        !/^[a-z][a-zA-Z0-9_-]{0,31}$/.test(command.sampleVar))
    ) {
      report.error(
        "SAMPLED_PATH_VARIABLE",
        `${path}.sampleVar`,
        "Expected a safe sample variable name.",
      );
    }
  }

  if (command.commands !== undefined) {
    if (!isUnknownArray(command.commands)) return;
    if (command.commands.length === 0) {
      report.error(
        "COMMANDS_EMPTY",
        `${path}.commands`,
        `Command "${diagnosticValue(command.op)}" must contain at least one child command.`,
      );
    }
  }
  if (command.items !== undefined) {
    if (!isUnknownArray(command.items)) {
      report.error("COMMAND_ITEMS_TYPE", `${path}.items`, "Expected an array.");
    } else if (command.items.length === 0) {
      report.error(
        "COMMAND_ITEMS_EMPTY",
        `${path}.items`,
        `Command "${diagnosticValue(command.op)}" requires at least one item.`,
      );
    }
  }
  if (command.bindings !== undefined) {
    if (!isRecord(command.bindings)) {
      report.error(
        "COMMAND_BINDINGS_TYPE",
        `${path}.bindings`,
        "Expected a named expression object.",
      );
    } else if (Object.keys(command.bindings).length === 0) {
      report.error(
        "COMMAND_BINDINGS_EMPTY",
        `${path}.bindings`,
        "Let requires at least one binding.",
      );
    }
  }
  if (command.points !== undefined) {
    validatePoints(command.points, `${path}.points`, report);
  }
  if (command.segments !== undefined) {
    validatePathSegments(command.segments, `${path}.segments`, report);
  }
  if (command.op === "path") {
    const sourceCount =
      Number(command.points !== undefined) +
      Number(command.segments !== undefined);
    if (sourceCount !== 1) {
      report.error(
        "COMMAND_PATH_SOURCE",
        path,
        "Path requires exactly one of points or segments.",
        "Use points for a polygon or segments for curves and arcs.",
      );
    }
  }
  for (const field of ["color", "fill", "stroke"]) {
    if (command[field] !== undefined) {
      validatePaint(command[field], `${path}.${field}`, report);
    }
  }
  if (command.filter !== undefined) {
    validateNumericRecord(
      command.filter,
      `${path}.filter`,
      FILTER_KEYS,
      report,
    );
  }
  if (command.shadow !== undefined) {
    validateShadow(command.shadow, `${path}.shadow`, report);
  }
  if (command.op === "renderPass" && typeof command.id === "string") {
    if (passes.duplicateIds.has(command.id)) {
      report.error(
        "RENDER_PASS_DUPLICATE",
        `${path}.id`,
        `Render pass "${command.id}" is declared more than once.`,
      );
    }
  }
  if (command.op === "compositePass" && typeof command.passId === "string") {
    if (!passes.ids.has(command.passId)) {
      report.error(
        "RENDER_PASS_UNKNOWN",
        `${path}.passId`,
        `Render pass "${command.passId}" is not declared.`,
        "Add one renderPass command with this id or correct the reference.",
      );
    }
  }
}

function validateStaticLoopField(
  value: unknown,
  path: string,
  report: EffectV1ValidationErrorReport,
): void {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > 512
  ) {
    report.error(
      "LOOP_BOUND",
      path,
      "Expected a static integer from 1 to 512.",
      "Use a bounded literal; runtime-sized loops are forbidden.",
    );
  }
}

function validateNumericExpression(
  value: unknown,
  path: string,
  report: EffectV1ValidationErrorReport,
): void {
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (isRecord(value) && typeof value.op === "string") return;
  report.error(
    "COMMAND_NUMBER",
    path,
    "Expected a finite number or a declared expression.",
  );
}

function validatePoints(
  value: unknown,
  path: string,
  report: EffectV1ValidationErrorReport,
): void {
  if (!isUnknownArray(value)) {
    report.error("COMMAND_POINTS_TYPE", path, "Expected a point array.");
    return;
  }
  if (value.length < 2) {
    report.error(
      "COMMAND_POINTS_SHORT",
      path,
      "A path needs at least two points.",
    );
  }
  value.forEach((point, index) => {
    const pointPath = `${path}[${index}]`;
    if (!isRecord(point)) {
      report.error("COMMAND_POINT_TYPE", pointPath, "Expected { x, y }.");
      return;
    }
    rejectUnknownKeys(point, new Set(["x", "y"]), pointPath, report);
    for (const coordinate of ["x", "y"]) {
      if (point[coordinate] === undefined) {
        report.error(
          "COMMAND_FIELD_REQUIRED",
          `${pointPath}.${coordinate}`,
          `Point requires field "${coordinate}".`,
        );
      } else {
        validateNumericExpression(
          point[coordinate],
          `${pointPath}.${coordinate}`,
          report,
        );
      }
    }
  });
}

const PATH_SEGMENT_FIELDS: Record<string, readonly string[]> = {
  arc: ["centerX", "centerY", "end", "radius", "start"],
  cubicTo: ["cp1x", "cp1y", "cp2x", "cp2y", "x", "y"],
  ellipse: [
    "centerX",
    "centerY",
    "end",
    "radiusX",
    "radiusY",
    "rotation",
    "start",
  ],
  lineTo: ["x", "y"],
  moveTo: ["x", "y"],
  quadraticTo: ["cpx", "cpy", "x", "y"],
  rect: ["height", "width", "x", "y"],
  roundRect: ["height", "radius", "width", "x", "y"],
};

function validatePathSegments(
  value: unknown,
  path: string,
  report: EffectV1ValidationErrorReport,
): void {
  if (!isUnknownArray(value)) {
    report.error(
      "COMMAND_PATH_SEGMENTS_TYPE",
      path,
      "Expected a segment array.",
    );
    return;
  }
  if (value.length === 0) {
    report.error(
      "COMMAND_PATH_SEGMENTS_EMPTY",
      path,
      "A path needs at least one segment.",
    );
  }
  value.forEach((segment, index) => {
    const segmentPath = `${path}[${index}]`;
    if (!isRecord(segment)) {
      report.error(
        "COMMAND_PATH_SEGMENT_TYPE",
        segmentPath,
        "Expected a path segment object.",
      );
      return;
    }
    const required =
      typeof segment.kind === "string" &&
      Object.hasOwn(PATH_SEGMENT_FIELDS, segment.kind)
        ? PATH_SEGMENT_FIELDS[segment.kind]
        : undefined;
    if (!required) {
      report.error(
        "COMMAND_PATH_SEGMENT_KIND",
        `${segmentPath}.kind`,
        `Unsupported path segment kind "${formatEffectV1DiagnosticValue(segment.kind)}".`,
      );
      return;
    }
    const allowed = new Set(["counterclockwise", "kind", ...required]);
    rejectUnknownKeys(segment, allowed, segmentPath, report);
    for (const field of required) {
      if (segment[field] === undefined) {
        report.error(
          "COMMAND_FIELD_REQUIRED",
          `${segmentPath}.${field}`,
          `Path segment "${diagnosticValue(segment.kind)}" requires field "${field}".`,
        );
      } else {
        validateNumericExpression(
          segment[field],
          `${segmentPath}.${field}`,
          report,
        );
      }
    }
    if (
      segment.counterclockwise !== undefined &&
      typeof segment.counterclockwise !== "boolean"
    ) {
      report.error(
        "COMMAND_BOOLEAN",
        `${segmentPath}.counterclockwise`,
        "Expected a boolean.",
      );
    }
  });
}

function validatePaint(
  value: unknown,
  path: string,
  report: EffectV1ValidationErrorReport,
): void {
  if (typeof value === "string") return;
  if (isRecord(value) && typeof value.op === "string") return;
  if (!isRecord(value)) {
    report.error(
      "PAINT_TYPE",
      path,
      "Expected a color, color expression, or gradient object.",
    );
    return;
  }
  if (value.kind !== "linearGradient" && value.kind !== "radialGradient") {
    report.error(
      "PAINT_KIND",
      `${path}.kind`,
      "Expected linearGradient or radialGradient.",
    );
    return;
  }
  const radial = value.kind === "radialGradient";
  rejectUnknownKeys(
    value,
    radial ? RADIAL_GRADIENT_KEYS : LINEAR_GRADIENT_KEYS,
    path,
    report,
  );
  for (const field of radial
    ? ["x0", "y0", "r0", "x1", "y1", "r1"]
    : ["x0", "y0", "x1", "y1"]) {
    if (value[field] === undefined) {
      report.error(
        "GRADIENT_FIELD_REQUIRED",
        `${path}.${field}`,
        `Gradient requires field "${field}".`,
      );
    } else {
      validateNumericExpression(value[field], `${path}.${field}`, report);
    }
  }
  if (!isUnknownArray(value.stops) || value.stops.length < 2) {
    report.error(
      "GRADIENT_STOPS",
      `${path}.stops`,
      "Gradient requires at least two color stops.",
    );
    return;
  }
  value.stops.forEach((stop: unknown, index: number) => {
    const stopPath = `${path}.stops[${index}]`;
    if (!isRecord(stop)) {
      report.error(
        "GRADIENT_STOP_TYPE",
        stopPath,
        "Expected { offset, color }.",
      );
      return;
    }
    rejectUnknownKeys(stop, GRADIENT_STOP_KEYS, stopPath, report);
    if (stop.color === undefined) {
      report.error(
        "GRADIENT_FIELD_REQUIRED",
        `${stopPath}.color`,
        'Gradient stop requires field "color".',
      );
    } else {
      validatePaint(stop.color, `${stopPath}.color`, report);
    }
    if (stop.offset === undefined) {
      report.error(
        "GRADIENT_FIELD_REQUIRED",
        `${stopPath}.offset`,
        'Gradient stop requires field "offset".',
      );
    } else {
      validateNumericExpression(stop.offset, `${stopPath}.offset`, report);
      if (
        typeof stop.offset === "number" &&
        (stop.offset < 0 || stop.offset > 1)
      ) {
        report.error(
          "GRADIENT_OFFSET_RANGE",
          `${stopPath}.offset`,
          "Gradient offset must be from 0 to 1.",
        );
      }
    }
  });
}

function validateNumericRecord(
  value: unknown,
  path: string,
  keys: Set<string>,
  report: EffectV1ValidationErrorReport,
): void {
  if (!isRecord(value)) {
    report.error("COMMAND_OBJECT_TYPE", path, "Expected an object.");
    return;
  }
  if (Object.keys(value).length === 0) {
    report.error(
      "COMMAND_OBJECT_EMPTY",
      path,
      "Expected at least one filter property.",
    );
  }
  rejectUnknownKeys(value, keys, path, report);
  for (const [key, child] of Object.entries(value)) {
    validateNumericExpression(child, `${path}.${key}`, report);
  }
}

function validateShadow(
  value: unknown,
  path: string,
  report: EffectV1ValidationErrorReport,
): void {
  if (!isRecord(value)) {
    report.error("COMMAND_OBJECT_TYPE", path, "Expected a shadow object.");
    return;
  }
  if (Object.keys(value).length === 0) {
    report.error(
      "COMMAND_OBJECT_EMPTY",
      path,
      "Expected at least one shadow property.",
    );
  }
  rejectUnknownKeys(value, SHADOW_KEYS, path, report);
  for (const field of ["blur", "x", "y"]) {
    if (value[field] !== undefined) {
      validateNumericExpression(value[field], `${path}.${field}`, report);
    }
  }
  if (
    value.color !== undefined &&
    typeof value.color !== "string" &&
    !(isRecord(value.color) && typeof value.color.op === "string")
  ) {
    report.error(
      "SHADOW_COLOR",
      `${path}.color`,
      "Expected a color string or expression.",
    );
  }
}

function walkCommands(
  commands: unknown[],
  visit: (command: Record<string, unknown>) => void,
): void {
  for (const value of commands) {
    if (!isRecord(value)) continue;
    visit(value);
    if (isUnknownArray(value.commands)) walkCommands(value.commands, visit);
  }
}
