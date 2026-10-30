import type { DomMotionBinding } from "./model.js";

type Read = (
  target: string,
  property: string,
  time: number,
  fallback: number,
) => number;

export function readDomMotionPose(
  binding: DomMotionBinding,
  time: number,
  progress: number,
  read: Read,
) {
  const remaining = 1 - progress;
  const defaults = {
    x: -binding.spread * remaining,
    y: -(binding.lift ?? 180) * remaining,
    z: binding.depth * remaining,
    rotateX: (binding.tiltX ?? 0) * remaining,
    rotateY: (binding.tiltY ?? 0) * remaining,
    rotateZ: (binding.tiltZ ?? 0) * remaining,
    scale: 1,
  };
  const values = Object.entries(defaults).map(([property, fallback]) =>
    read(binding.id, property, time, fallback),
  );
  return {
    settled: values.every(
      (value, index) => Math.abs(value - (index === 6 ? 1 : 0)) < 0.00001,
    ),
    transform: `translate3d(${values[0]}px,${values[1]}px,${values[2] + 2}px) rotateX(${values[3]}deg) rotateY(${values[4]}deg) rotateZ(${values[5]}deg) scale(${values[6]})`,
  };
}
