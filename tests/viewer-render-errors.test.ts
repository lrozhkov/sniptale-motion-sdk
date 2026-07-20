import { describe, expect, it, vi } from "vitest";

import { resolveViewerRenderFailureMessage } from "../src/apps/viewer/rendering/errors";

describe("viewer render failure messages", () => {
  it("resolves worker error codes through i18n", () => {
    const translate = vi.fn((key: string) => `translated:${key}`);

    expect(
      resolveViewerRenderFailureMessage(translate, {
        errorCode: "BACKGROUND_RENDERER_STOPPED",
      }),
    ).toBe("translated:viewer.rendering.backgroundStopped");
    expect(
      resolveViewerRenderFailureMessage(translate, {
        errorCode: "WORKER_RENDER_PREPARATION_FAILED",
      }),
    ).toBe("translated:viewer.rendering.workerPreparationFailed");
  });

  it("keeps an explicit sandbox error before the localized fallback", () => {
    const translate = vi.fn(() => "localized fallback");
    expect(
      resolveViewerRenderFailureMessage(translate, { error: "Effect error" }),
    ).toBe("Effect error");
    expect(resolveViewerRenderFailureMessage(translate, {})).toBe(
      "localized fallback",
    );
  });
});
