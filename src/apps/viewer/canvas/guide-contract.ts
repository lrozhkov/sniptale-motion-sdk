import type { CanvasGuideSnapLock } from "./guide-snap-axis.js";
import type { EffectLayer } from "../../../sdk/types.js";
import type { CanvasPoint, CanvasRect } from "./geometry-contract.js";
export type CanvasGuideRecentRelease = {
  guide: { label: string; value: number };
  remaining: number;
};

export interface CanvasGuideSnapSession {
  xAnchorOffsets: number[];
  xGuides: Array<{ label: string; value: number }>;
  xLock: CanvasGuideSnapLock | null;
  xRecentRelease: CanvasGuideRecentRelease | null;
  yAnchorOffsets: number[];
  yGuides: Array<{ label: string; value: number }>;
  yLock: CanvasGuideSnapLock | null;
  yRecentRelease: CanvasGuideRecentRelease | null;
}

export interface CanvasGuideActions {
  createCanvasGuideSnapSession(
    layerId: string,
    layer: EffectLayer,
    position: CanvasPoint,
  ): CanvasGuideSnapSession | null;
  createCanvasGuideSnapSessionForBox(
    box: CanvasRect,
    position?: CanvasPoint,
    excludedLayerIds?: string[],
  ): CanvasGuideSnapSession;
  applyCanvasGuideSnap(
    session: CanvasGuideSnapSession | null,
    x: number,
    y: number,
  ): CanvasPoint & { snap: string[] };
  getCanvasSnapGuides(
    size: number,
    safeInsetRatio: number,
  ): { label: string; value: number }[];
}
