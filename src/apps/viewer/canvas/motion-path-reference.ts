export type MotionPathPointRef = {
  layerId: string;
  xKeyframeId: string;
  yKeyframeId: string;
};

export function motionPathPointKey(ref: MotionPathPointRef): string {
  return JSON.stringify([ref.layerId, ref.xKeyframeId, ref.yKeyframeId]);
}
