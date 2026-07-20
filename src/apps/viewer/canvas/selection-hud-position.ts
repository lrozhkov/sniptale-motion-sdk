type CanvasHudPositionInput = {
  hud: { height: number; width: number };
  placement?: "managed" | "selection";
  selection: { height: number; left: number; top: number; width: number };
  stage: { height: number; width: number };
};

const HUD_GAP = 12;
const HUD_INSET = 8;
const HUD_TOP_INSET = 38;
const MANAGED_HUD_TOP_INSET = 48;

export function resolveCanvasHudPosition({
  hud,
  placement = "selection",
  selection,
  stage,
}: CanvasHudPositionInput): { left: number; top: number } {
  const maxLeft = Math.max(HUD_INSET, stage.width - hud.width - HUD_INSET);
  const maxTop = Math.max(HUD_TOP_INSET, stage.height - hud.height - HUD_INSET);
  if (placement === "managed") {
    return {
      left: Math.min(maxLeft, Math.max(HUD_INSET, selection.left + HUD_GAP)),
      top: Math.min(
        maxTop,
        Math.max(MANAGED_HUD_TOP_INSET, selection.top + HUD_GAP),
      ),
    };
  }
  const centeredLeft = selection.left + (selection.width - hud.width) / 2;
  const candidates = [
    {
      left: selection.left + selection.width + HUD_GAP,
      top: selection.top,
    },
    { left: selection.left - hud.width - HUD_GAP, top: selection.top },
    {
      left: centeredLeft,
      top: selection.top + selection.height + HUD_GAP,
    },
    { left: centeredLeft, top: selection.top - hud.height - HUD_GAP },
  ];
  const fits = (candidate: { left: number; top: number }) =>
    candidate.left >= HUD_INSET &&
    candidate.left <= maxLeft &&
    candidate.top >= HUD_TOP_INSET &&
    candidate.top <= maxTop;
  const overflow = (candidate: { left: number; top: number }) =>
    Math.max(0, HUD_INSET - candidate.left) +
    Math.max(0, candidate.left - maxLeft) +
    Math.max(0, HUD_TOP_INSET - candidate.top) +
    Math.max(0, candidate.top - maxTop);
  const candidate =
    candidates.find(fits) ??
    candidates.reduce((best, next) =>
      overflow(next) < overflow(best) ? next : best,
    );
  return {
    left: Math.min(maxLeft, Math.max(HUD_INSET, candidate.left)),
    top: Math.min(maxTop, Math.max(HUD_TOP_INSET, candidate.top)),
  };
}
