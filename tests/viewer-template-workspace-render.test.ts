import { describe, expect, it, vi } from "vitest";

import { renderTemplateWorkspace } from "../src/apps/viewer/templates/workspace-render";

describe("viewer template workspace render", () => {
  it("delegates each adopted surface to one workspace render path", () => {
    const template = { id: "composition-a" };
    const ctx = {
      renderControls: vi.fn(),
      renderTimelineEditor: vi.fn(),
    } as any;

    renderTemplateWorkspace(ctx, template);

    expect(ctx.renderControls).toHaveBeenCalledOnce();
    expect(ctx.renderControls).toHaveBeenCalledWith(template);
    expect(ctx.renderTimelineEditor).toHaveBeenCalledOnce();
    expect(ctx.renderTimelineEditor).toHaveBeenCalledWith(template);
  });
});
