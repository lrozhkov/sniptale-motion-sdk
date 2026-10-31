import type {
  EffectTimeline,
  TimelineTrack,
  TimelineKeyframe,
} from "../types.js";
import {
  DOM_MOTION_PROPERTIES,
  DOM_MOTION_SCHEMA,
  type DomMotionBinding,
  type DomMotionDocument,
} from "./model.js";

const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/;
const EASINGS = new Set(["linear", "in", "out", "inOut", "hold", "bezier"]);
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
function number(v: unknown, min: number, max: number, name: string): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw new Error(`Invalid DOM motion ${name}`);
  return v;
}
function identifier(v: unknown): string {
  if (typeof v !== "string" || !ID.test(v) || v === "__proto__")
    throw new Error("Invalid DOM motion identifier");
  return v;
}
function label(v: unknown): { ru: string; en: string } {
  if (
    !record(v) ||
    typeof v.ru !== "string" ||
    typeof v.en !== "string" ||
    !v.ru.trim() ||
    !v.en.trim() ||
    v.ru.length > 200 ||
    v.en.length > 200
  )
    throw new Error("Invalid DOM motion locale label");
  return { ru: v.ru, en: v.en };
}
function selector(v: unknown): string {
  if (typeof v !== "string" || !v.trim() || v.length > 300)
    throw new Error("Invalid DOM motion selector");
  return v;
}
export function parseDomMotionDocument(value: unknown): DomMotionDocument {
  if (!record(value) || value.schemaVersion !== DOM_MOTION_SCHEMA)
    throw new Error("Invalid DOM motion schema");
  const duration = number(value.duration, 0.1, 300, "duration");
  const width = number(value.width, 1, 8192, "width");
  const height = number(value.height, 1, 8192, "height");
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width * height > 20_000_000
  )
    throw new Error("Invalid DOM motion viewport");
  if (
    typeof value.html !== "string" ||
    value.html.length === 0 ||
    value.html.length > 12_000_000
  )
    throw new Error("Invalid DOM motion HTML");
  if (
    !Array.isArray(value.bindings) ||
    value.bindings.length === 0 ||
    value.bindings.length > 32
  )
    throw new Error("Invalid DOM motion bindings");
  const ids = new Set(["page"]);
  const bindings = value.bindings.map((b): DomMotionBinding => {
    if (!record(b)) throw new Error("Invalid DOM motion binding");
    const id = identifier(b.id);
    if (ids.has(id)) throw new Error("Duplicate DOM motion binding");
    ids.add(id);
    return {
      id,
      label: label(b.label),
      selector: selector(b.selector),
      ...(b.closest === undefined ? {} : { closest: selector(b.closest) }),
      ...(b.parts === undefined ? {} : { parts: selector(b.parts) }),
      stagger: number(b.stagger, 0, 2, "stagger"),
      ...(b.partDelay === undefined
        ? {}
        : { partDelay: number(b.partDelay, 0, 2, "partDelay") }),
      depth: number(b.depth, 0, 2000, "depth"),
      ...(b.lift === undefined
        ? {}
        : { lift: number(b.lift, -2000, 2000, "lift") }),
      ...(b.partLift === undefined
        ? {}
        : { partLift: number(b.partLift, -2000, 2000, "partLift") }),
      ...(b.tiltX === undefined
        ? {}
        : { tiltX: number(b.tiltX, -45, 45, "tiltX") }),
      ...(b.tiltY === undefined
        ? {}
        : { tiltY: number(b.tiltY, -45, 45, "tiltY") }),
      ...(b.tiltZ === undefined
        ? {}
        : { tiltZ: number(b.tiltZ, -45, 45, "tiltZ") }),
      spread: number(b.spread, -2000, 2000, "spread"),
    };
  });
  return {
    schemaVersion: DOM_MOTION_SCHEMA,
    id: identifier(value.id),
    label: label(value.label),
    duration,
    width,
    height,
    html: value.html,
    bindings,
    timeline: parseDomMotionTimeline(value.timeline, duration, ids),
  };
}
export function parseDomMotionTimeline(
  value: unknown,
  duration: number,
  targets: ReadonlySet<string>,
): EffectTimeline {
  if (
    !record(value) ||
    !Array.isArray(value.tracks) ||
    value.tracks.length > 400 ||
    !Array.isArray(value.phases) ||
    value.phases.length !== 0 ||
    value.motionPaths !== undefined
  )
    throw new Error("Invalid DOM motion timeline");
  const ids = new Set<string>();
  const tracks: TimelineTrack[] = value.tracks.map((t) => {
    if (
      !record(t) ||
      typeof t.target !== "string" ||
      !targets.has(t.target) ||
      typeof t.property !== "string" ||
      !(DOM_MOTION_PROPERTIES as readonly string[]).includes(t.property) ||
      t.id !== `${t.target}.${t.property}` ||
      ids.has(String(t.id)) ||
      t.phaseId != null ||
      t.sceneId != null ||
      !Array.isArray(t.keyframes) ||
      t.keyframes.length === 0 ||
      t.keyframes.length > 128
    )
      throw new Error("Invalid DOM motion track");
    ids.add(String(t.id));
    const property = t.property;
    if (
      t.target === "page"
        ? t.property === "assembly"
        : t.property === "opacity" ||
          t.property === "blur" ||
          t.property === "scrollbarOpacity"
    )
      throw new Error("Invalid DOM motion property owner");
    let previous = -1;
    const keyIds = new Set();
    const keyframes = t.keyframes.map((k, index) => {
      if (
        !record(k) ||
        k.phaseId != null ||
        k.sceneId != null ||
        (k.enabled !== undefined && typeof k.enabled !== "boolean")
      )
        throw new Error("Invalid DOM motion keyframe");
      const time = number(k.time, 0, duration, "keyframe time");
      if (time <= previous) throw new Error("Unordered DOM motion keyframes");
      previous = time;
      const id = k.id === undefined ? `key-${index}` : identifier(k.id);
      if (keyIds.has(id)) throw new Error("Duplicate DOM motion keyframe");
      keyIds.add(id);
      const easing = k.easing ?? "linear";
      if (typeof easing !== "string" || !EASINGS.has(easing))
        throw new Error("Invalid DOM motion easing");
      let handles: TimelineKeyframe["handles"];
      if (easing === "bezier") {
        if (!record(k.handles)) throw new Error("Invalid DOM motion handles");
        handles = {
          x1: number(k.handles.x1, 0, 1, "handle"),
          x2: number(k.handles.x2, 0, 1, "handle"),
          y1: number(k.handles.y1, 0, 1, "handle"),
          y2: number(k.handles.y2, 0, 1, "handle"),
        };
      }
      const limits: readonly [number, number] =
        t.property === "assembly" ||
        t.property === "opacity" ||
        t.property === "scrollbarOpacity"
          ? [0, 1]
          : t.property === "scale"
            ? [0.01, 4]
            : t.property === "blur"
              ? [0, 40]
              : property.startsWith("rotate")
                ? [-180, 180]
                : [-8192, 8192];
      return {
        id,
        time,
        value: number(k.value, limits[0], limits[1], "keyframe value"),
        easing,
        ...(handles ? { handles } : {}),
        ...(k.enabled === undefined ? {} : { enabled: k.enabled === true }),
      };
    });
    if (t.enabled !== undefined && typeof t.enabled !== "boolean")
      throw new Error("Invalid DOM motion enabled flag");
    return {
      id: String(t.id),
      target: t.target,
      layerId: t.target,
      property: t.property,
      ...(typeof t.label === "string" ? { label: t.label.slice(0, 200) } : {}),
      keyframes,
      ...(t.enabled === undefined ? {} : { enabled: t.enabled === true }),
    };
  });
  for (const target of targets) {
    if (target !== "page" && !ids.has(`${target}.assembly`))
      throw new Error(`Missing DOM motion assembly track: ${target}`);
  }
  return { phases: [], tracks };
}
