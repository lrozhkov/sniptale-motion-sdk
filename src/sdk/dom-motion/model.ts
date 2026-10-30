import type { EffectTimeline } from "../types.js";

export type DomMotionNode = { element: HTMLElement; style: string | null };

export const DOM_MOTION_SCHEMA = "sniptale.dom-motion.v1";
export const DOM_MOTION_PROPERTIES = [
  "x",
  "y",
  "z",
  "rotateX",
  "rotateY",
  "rotateZ",
  "scale",
  "opacity",
  "blur",
  "scrollbarOpacity",
  "assembly",
] as const;
export type DomMotionProperty = (typeof DOM_MOTION_PROPERTIES)[number];
export type DomMotionBinding = {
  id: string;
  label: { ru: string; en: string };
  selector: string;
  closest?: string;
  /** Semantic descendants, such as field rows, headings and action buttons. */
  parts?: string;
  stagger: number;
  /** Initial delay of semantic descendants relative to the panel, in seconds. */
  partDelay?: number;
  depth: number;
  lift?: number;
  partLift?: number;
  tiltX?: number;
  tiltY?: number;
  tiltZ?: number;
  spread: number;
};
/** Scriptless HTML, animated as live DOM. This is distinct from a Canvas Effect v1 graph. */
export type DomMotionDocument = {
  schemaVersion: typeof DOM_MOTION_SCHEMA;
  id: string;
  label: { ru: string; en: string };
  duration: number;
  width: number;
  height: number;
  html: string;
  bindings: DomMotionBinding[];
  timeline: EffectTimeline;
};
