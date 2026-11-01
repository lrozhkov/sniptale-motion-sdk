import type { MotionPathTangent } from "../../../shared/timeline/motion-path.js";
export function normalizeTangent(
  tangent: MotionPathTangent,
): MotionPathTangent {
  const length = tangentLength(tangent);
  return length > 0.0001
    ? { x: tangent.x / length, y: tangent.y / length }
    : { x: 1, y: 0 };
}
export function scaleTangent(
  tangent: MotionPathTangent,
  scale: number,
): MotionPathTangent {
  return { x: tangent.x * scale, y: tangent.y * scale };
}
export function tangentLength(tangent: MotionPathTangent): number {
  return Math.hypot(Number(tangent?.x) || 0, Number(tangent?.y) || 0);
}
