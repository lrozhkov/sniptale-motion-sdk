import { afterEach, describe, expect, it, vi } from "vitest";
import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

import { renderTemplateWorkspace } from "../src/apps/viewer/templates/workspace-render";

describe("viewer template workspace render", () => {
  it("delegates each adopted surface to one workspace render path", () => {
    const template = { id: "composition-a", duration: 1 };
    const ctx = createViewerContextFixture();
    const controls = vi
      .spyOn(ctx, "renderControls")
      .mockImplementation(() => {});
    const timeline = vi
      .spyOn(ctx, "renderTimelineEditor")
      .mockImplementation(() => {});

    renderTemplateWorkspace(ctx, template);

    expect(controls).toHaveBeenCalledOnce();
    expect(controls).toHaveBeenCalledWith(template);
    expect(timeline).toHaveBeenCalledOnce();
    expect(timeline).toHaveBeenCalledWith(template);
  });
});
