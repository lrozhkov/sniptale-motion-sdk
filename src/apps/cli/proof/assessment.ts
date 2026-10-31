import type { EffectV1Document } from "../../../sdk/effect-v1/types.js";
import type { ControlDefinition } from "../../../sdk/types.js";
import type { FrameObservation } from "../../../shared/proof/frame-observation.js";

export type ProofFrame = {
  hash: string;
  occupied: number;
  lit: number;
  time: number;
  observation: FrameObservation;
};
export function proofTimes(document: EffectV1Document): number[] {
  const d = document.duration;
  const times = new Set([
    0,
    Math.min(0.35, d * 0.18),
    d / 2,
    Math.max(0, d - Math.min(0.35, d * 0.18)),
    d,
  ]);
  for (const range of [
    ...document.scenes,
    ...document.clips,
    ...document.timeline.phases,
  ]) {
    times.add(range.start);
    times.add(range.start + range.duration / 2);
    times.add(range.start + range.duration);
  }
  for (const track of document.timeline.tracks)
    for (const key of track.keyframes) times.add(key.time);
  return [...times]
    .filter((time) => time >= 0 && time <= d)
    .sort((a, b) => a - b);
}
export function alternateControl(control: ControlDefinition): number | string {
  if (control.options?.length) {
    const option = control.options.find(
      (entry) => !Object.is(entry.value, control.defaultValue),
    );
    if (option) return option.value;
    throw new Error("PROOF_CONTROL_VARIANT");
  }
  if (control.kind === "text")
    return `${control.defaultValue || "Sniptale"} · proof`;
  if (control.kind === "color")
    return control.defaultValue.toLowerCase() === "#ff2d55"
      ? "#00d4ff"
      : "#ff2d55";
  const candidates = [
    control.max,
    control.min,
    control.defaultValue + Math.max(Math.abs(control.step ?? 1), 1),
    control.defaultValue - Math.max(Math.abs(control.step ?? 1), 1),
  ];
  const value = candidates.find(
    (candidate) =>
      typeof candidate === "number" &&
      Number.isFinite(candidate) &&
      candidate !== control.defaultValue &&
      candidate >= (control.min ?? -Infinity) &&
      candidate <= (control.max ?? Infinity),
  );
  if (value === undefined) throw new Error("PROOF_CONTROL_VARIANT");
  return value;
}
export function assessFrames(frames: ProofFrame[], duration: number) {
  const midpoint = frames.find(
    (frame) => Math.abs(frame.time - duration / 2) < 1e-6,
  );
  return {
    animated: new Set(frames.map((frame) => frame.hash)).size > 1,
    midpointVisible: Boolean(
      midpoint && midpoint.occupied >= 24 && midpoint.lit >= 24,
    ),
  };
}
export function assessBindings(
  document: EffectV1Document,
  frames: ProofFrame[],
) {
  const missing = (
    key: "controls" | "phases" | "tracks",
    expected: string[],
  ) => {
    const actual = new Set(
      frames.flatMap((frame) => frame.observation.bindings[key]),
    );
    return expected.filter((id) => !actual.has(id));
  };
  return {
    controls: missing(
      "controls",
      document.controls.map((control) => control.id),
    ),
    phases: missing(
      "phases",
      document.timeline.phases.map((phase) => phase.id),
    ),
    tracks: missing(
      "tracks",
      document.timeline.tracks.map((track) => track.id),
    ),
  };
}

export function assessAssetTransfers(
  document: EffectV1Document,
  frames: ProofFrame[],
) {
  const visual = document.assets.filter(
    (asset) =>
      asset.kind === "image" ||
      asset.kind === "svg" ||
      asset.mimeType.startsWith("image/"),
  );
  const bitmapTransfers = Math.max(
    0,
    ...frames.map((frame) => frame.observation.assetBitmapTransfers),
  );
  const envelopeTransfers = Math.max(
    0,
    ...frames.map((frame) => frame.observation.assetEnvelopeTransfers),
  );
  return {
    declared: document.assets.length,
    visual: visual.length,
    bitmapTransfers,
    envelopeTransfers,
    ok:
      visual.length === 0 ||
      (bitmapTransfers >= visual.length && envelopeTransfers > 0),
  };
}
