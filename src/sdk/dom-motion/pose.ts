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
  const values = { ...defaults };
  for (const property of Object.keys(defaults) as (keyof typeof defaults)[]) {
    values[property] = read(binding.id, property, time, defaults[property]);
  }
  return {
    settled: Object.entries(values).every(
      ([property, value]) =>
        Math.abs(value - (property === "scale" ? 1 : 0)) < 0.00001,
    ),
    transform: `translate3d(${values.x}px,${values.y}px,${values.z + 2}px) rotateX(${values.rotateX}deg) rotateY(${values.rotateY}deg) rotateZ(${values.rotateZ}deg) scale(${values.scale})`,
  };
}
