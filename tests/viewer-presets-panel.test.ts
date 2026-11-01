import { afterEach, describe, expect, it, vi } from "vitest";

import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import type {
  EditorControl,
  EditorPreset,
} from "../src/apps/viewer/templates/model.js";
import { readEditorPresets } from "../src/apps/viewer/templates/source.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("viewer preset actions", () => {
  it("rejects save and duplicate actions when a template has no controls", () => {
    const { ctx, applyEditorCommand } = createPresetContext({
      controls: [],
      presets: [createPreset("existing", "Existing")],
      selectedPresetId: "existing",
    });

    expect(ctx.saveCurrentAsPreset()).toBeNull();
    expect(ctx.duplicateSelectedPreset()).toBeNull();
    expect(ctx.duplicatePreset("existing")).toBeNull();
    expect(applyEditorCommand).not.toHaveBeenCalled();
  });

  it("deletes the requested preset through editor history and clears selection", () => {
    const {
      ctx,
      getPresets,
      applyEditorCommand,
      renderPresetsPanel,
      updateExportAvailability,
    } = createPresetContext({
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
    expect(applyEditorCommand).toHaveBeenCalledWith(
      { payload: { presetId: "remove-me" }, type: "deletePreset" },
      expect.any(Function),
    );
    expect(ctx.refs.timelineSaveStatus.textContent).toBe(
      "Deleted preset Remove me",
    );
    expect(renderPresetsPanel).toHaveBeenCalledOnce();
    expect(updateExportAvailability).toHaveBeenCalledOnce();
  });
});

function createPreset(id: string, label: string): EditorPreset {
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

function createPresetContext({
  controls,
  presets,
  selectedPresetId,
}: {
  controls: EditorControl[];
  presets: EditorPreset[];
  selectedPresetId: string;
}) {
  const ctx = createViewerContextFixture();
  ctx.state.currentTemplate = {
    controls,
    id: "template",
    duration: 3,
    layers: [],
    clips: [],
    scenes: [],
  };
  ctx.state.selectedPresetId = selectedPresetId;
  ctx.setPresets(presets);
  ctx.deps.t = (_key: string, fallback?: string) => fallback ?? _key;
  vi.spyOn(ctx, "logDiagnostic").mockImplementation(() => {});
  const applyEditorCommand = vi
    .spyOn(ctx, "applyEditorCommand")
    .mockImplementation((_command, apply) => apply());
  const renderPresetsPanel = vi
    .spyOn(ctx, "renderPresetsPanel")
    .mockImplementation(() => {});
  const updateExportAvailability = vi
    .spyOn(ctx, "updateExportAvailability")
    .mockImplementation(() => {});
  return {
    ctx,
    applyEditorCommand,
    renderPresetsPanel,
    updateExportAvailability,
    getPresets: () => readEditorPresets(ctx.getEditorOverride().presets),
  };
}
