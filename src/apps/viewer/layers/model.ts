import type { MotionPathTrack } from "../../../shared/timeline/motion-path.js";

export type TrackLayerSource = Partial<
  Pick<MotionPathTrack, "id" | "target" | "layerId">
>;
