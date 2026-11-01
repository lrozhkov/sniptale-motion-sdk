import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import { createStarterDocument } from "../src/apps/cli/starter.js";
import { normalizeEffectV1ToTemplate } from "../src/sdk/effect-v1/normalization.js";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("viewer effect-file export readiness", () => {
  it("blocks export neutrally until renderer contract coverage is ready", () => {
    let pending = true;
    const ctx = createContext(() => pending);

    ctx.updateExportAvailability();

    expect(exportButtons(ctx).every((button) => button.disabled)).toBe(true);
    expect(ctx.refs.timelineSaveStatus).toMatchObject({
      dataset: { validation: "pending" },
      textContent: "Waiting for renderer contract check.",
      title: "Waiting for renderer contract check.",
    });
    expect(ctx.assertExportable("Export blocked")).toBe(false);
    expect(ctx.logDiagnostic).not.toHaveBeenCalled();

    pending = false;
    ctx.updateExportAvailability();

    expect(ctx.refs.exportJsonButton.disabled).toBe(false);
    expect(ctx.refs.exportEffectFileButton.disabled).toBe(false);
    expect(ctx.refs.exportMp4Button.disabled).toBe(false);
    expect(ctx.refs.saveJsonButton.disabled).toBe(true);
    expect(ctx.refs.timelineSaveStatus).toMatchObject({
      dataset: { validation: "valid" },
      textContent: "No source file open",
      title: "Current effect JSON is valid for export.",
    });
  });

  it("keeps validation failures distinct from the pending state", () => {
    const ctx = createContext(() => false, ["Track is not renderer-bound"]);

    ctx.updateExportAvailability();

    expect(exportButtons(ctx).every((button) => button.disabled)).toBe(true);
    expect(ctx.refs.timelineSaveStatus).toMatchObject({
      dataset: { validation: "invalid" },
      textContent: "Validation issues: 1",
      title: "Track is not renderer-bound",
    });
    expect(ctx.assertExportable("Export blocked")).toBe(false);
    expect(ctx.logDiagnostic).toHaveBeenCalledWith(
      "Export blocked: Track is not renderer-bound",
      "error",
    );
  });
});

function createContext(isPending: () => boolean, errors: string[] = []) {
  const ctx = createViewerContextFixture();
  ctx.state.currentTemplate = normalizeEffectV1ToTemplate(
    createStarterDocument("template", "standalone"),
  );
  vi.spyOn(ctx, "collectEditorValidationErrors").mockReturnValue(errors);
  vi.spyOn(ctx, "isRendererContractCoveragePending").mockImplementation(
    isPending,
  );
  const logDiagnostic = vi
    .spyOn(ctx, "logDiagnostic")
    .mockImplementation(() => {});
  ctx.deps.t = (key: string, fallback?: string) => fallback ?? key;
  ctx.refs.timelineSaveStatus.textContent = "No source file open";
  return Object.assign(ctx, { logDiagnostic });
}

function exportButtons(ctx: ReturnType<typeof createContext>) {
  return [
    ctx.refs.exportJsonButton,
    ctx.refs.exportEffectFileButton,
    ctx.refs.exportMp4Button,
  ];
}
