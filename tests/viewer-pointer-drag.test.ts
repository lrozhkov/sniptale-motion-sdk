import { describe, expect, it } from "vitest";

import { installAppPointerDragOwner } from "../src/apps/viewer/app/pointer-drag";

describe("viewer pointer drag click suppression", () => {
  it("suppresses one generated click only on the dragged target", () => {
    const draggedTarget = {};
    const otherTarget = {};
    const ctx: any = {
      state: {
        dragSuppressClickTarget: draggedTarget,
        dragSuppressClickUntil: performance.now() + 1000,
      },
    };
    installAppPointerDragOwner(ctx);

    expect(ctx.shouldSuppressDragClick({ currentTarget: otherTarget })).toBe(
      false,
    );
    expect(ctx.shouldSuppressDragClick({ currentTarget: draggedTarget })).toBe(
      true,
    );
    expect(ctx.shouldSuppressDragClick({ currentTarget: draggedTarget })).toBe(
      false,
    );
  });
});
