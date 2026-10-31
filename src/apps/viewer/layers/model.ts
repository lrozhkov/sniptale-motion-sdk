import type { MotionPathTrack } from "../../../shared/timeline/motion-path.js";

export type TrackLayerSource = Pick<
  MotionPathTrack,
  "id" | "target" | "layerId"
>;
