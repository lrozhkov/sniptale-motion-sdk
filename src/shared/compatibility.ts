import { EFFECT_V1_SCHEMA } from "../sdk/effect-v1/types.js";

export const MOTION_COMPATIBILITY = {
  schemaVersion: "sniptale.motion-distribution.v1",
  projectSchema: "sniptale.motion-project.v1",
  effectSchema: EFFECT_V1_SCHEMA,
  toolkitCompatibility: "sniptale.motion-toolkit.alpha.1",
} as const;
