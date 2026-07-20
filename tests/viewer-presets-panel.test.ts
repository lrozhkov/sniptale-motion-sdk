import { describe, expect, it, vi } from "vitest";

import { installPanelsPresetsOwner } from "../src/apps/viewer/panels/presets";

describe("viewer preset actions", () => {
  it("rejects save and duplicate actions when a template has no controls", () => {
    const { ctx } = createPresetContext({
      controls: [],
      presets: [createPreset("existing", "Existing")],
      selectedPresetId: "existing",
    });

    expect(ctx.saveCurrentAsPreset()).toBeNull();
    expect(ctx.duplicateSelectedPreset()).toBeNull();
    expect(ctx.duplicatePreset("existing")).toBeNull();
    expect(ctx.applyEditorCommand).not.toHaveBeenCalled();
  });

  it("deletes the requested preset through editor history and clears selection", () => {
    const { ctx, getPresets } = createPresetContext({
      controls: [{ defaultValue: 1, id: "speed" }],
      presets: [
        createPreset("remove-me", "Remove me"),
        createPreset("keep-me", "Keep me"),
      ],
      selectedPresetId: "remove-me",
    });

    expect(ctx.deletePreset("remove-me")).toBe(true);
    expect(getPresets().map((preset) => preset.id)).toEqual(["keep-me"]);
    expect(ctx.state.selectedPresetId).toBeNull();
    expect(ctx.applyEditorCommand).toHaveBeenCalledWith(
      { payload: { presetId: "remove-me" }, type: "deletePreset" },
      expect.any(Function),
    );
    expect(ctx.refs.timelineSaveStatus.textContent).toBe(
      "Deleted preset Remove me",
    );
    expect(ctx.renderPresetsPanel).toHaveBeenCalledOnce();
    expect(ctx.updateExportAvailability).toHaveBeenCalledOnce();
  });
});

function createPreset(id: string, label: string): any {
  return {
    clips: [],
    controls: {},
    duration: 3,
    id,
    label: { en: label, ru: label },
    layers: [],
    scenes: [],
    timeline: { phases: [], tracks: [] },
  };
}

function createPresetContext({ controls, presets, selectedPresetId }) {
  let currentPresets = presets;
  const template = { controls, id: "template" };
  const ctx: any = {
    applyEditorCommand: vi.fn((_command, apply) => apply()),
    deps: {
      t: (_key, fallback) => fallback,
      translateText: (label, fallback) => label?.en ?? fallback,
    },
    getEffectiveTemplate: () => ({
      ...template,
      presets: currentPresets,
    }),
    logDiagnostic: vi.fn(),
    refs: { timelineSaveStatus: { textContent: "" } },
    state: {
      currentTemplate: template,
      selectedPresetId,
    },
    updateExportAvailability: vi.fn(),
  };
  installPanelsPresetsOwner(ctx);
  ctx.renderPresetsPanel = vi.fn();
  ctx.setPresets = vi.fn((nextPresets) => {
    currentPresets = nextPresets;
  });
  return { ctx, getPresets: () => currentPresets };
}
