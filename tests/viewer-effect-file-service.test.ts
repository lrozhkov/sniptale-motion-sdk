import { describe, expect, it, vi } from "vitest";

import { createEffectExportReadinessActions } from "../src/apps/viewer/effect-file/service";

describe("viewer effect-file export readiness", () => {
  it("blocks export neutrally until renderer contract coverage is ready", () => {
    let pending = true;
    const ctx = createContext(() => pending);
    Object.assign(
      ctx,
      createEffectExportReadinessActions(() => ctx),
    );

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
    Object.assign(
      ctx,
      createEffectExportReadinessActions(() => ctx),
    );

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

function createContext(isPending, errors: string[] = []) {
  const button = () => ({ disabled: false, title: "" });
  return {
    collectEditorValidationErrors: vi.fn(() => errors),
    deps: { t: (_key, fallback) => fallback },
    getEffectiveTemplate: (template) => template,
    isRendererContractCoveragePending: isPending,
    logDiagnostic: vi.fn(),
    refs: {
      exportEffectFileButton: button(),
      exportJsonButton: button(),
      exportMp4Button: button(),
      saveJsonButton: button(),
      timelineSaveStatus: {
        dataset: {},
        textContent: "No source file open",
        title: "",
      },
    },
    state: {
      currentTemplate: {
        effectV1: { program: { commands: [], kind: "graph", version: 1 } },
        id: "template",
      },
      templateFileHandle: null,
    },
  } as any;
}

function exportButtons(ctx) {
  return [
    ctx.refs.exportJsonButton,
    ctx.refs.exportEffectFileButton,
    ctx.refs.exportMp4Button,
  ];
}
