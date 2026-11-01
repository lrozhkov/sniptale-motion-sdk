import { afterEach, describe, expect, it, vi } from "vitest";

import { parseLocalEffectCatalog } from "../src/apps/viewer/effect-file/local-catalog";
import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import { requiredEntry } from "./helpers/required-entry.js";
import { createStarterDocument } from "../src/apps/cli/starter.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("viewer local effect startup", () => {
  it.each(["catalog", "rejected", "thrown"] as const)(
    "shows %s failures instead of an empty ready workspace",
    async (mode) => {
      const ctx = createViewerContextFixture();
      vi.stubGlobal("window", {
        location: { search: `?studioSession=${"a".repeat(64)}` },
      });
      const message = "LAYER_STRING $.layers[0].name: Expected a string.";
      vi.spyOn(ctx.deps, "loadLocalEffectCatalog").mockResolvedValue({
        effects:
          mode === "catalog"
            ? []
            : [
                {
                  source: "invalid source",
                  sourceName: "bad.json",
                  default: true,
                },
              ],
        errors: mode === "catalog" ? [message] : [],
      });
      const importer = vi.spyOn(ctx, "importEffectFileSource");
      if (mode === "thrown") importer.mockRejectedValue(new Error(message));
      else
        importer.mockResolvedValue({
          ok: false,
          templateId: null,
          errors: [message],
        });
      vi.spyOn(ctx, "logDiagnostic").mockImplementation(() => {});
      vi.spyOn(ctx, "populateTemplates").mockImplementation(() => {});
      const select = vi
        .spyOn(ctx, "selectInitialTemplateWhenReady")
        .mockResolvedValue(undefined);
      const status = vi
        .spyOn(ctx, "setPackStatus")
        .mockImplementation(() => {});
      await expect(ctx.bootstrapLocalEffects()).resolves.toBe(true);
      expect(ctx.refs.localEffectErrors.hidden).toBe(false);
      expect(ctx.refs.localEffectErrorDetails.textContent).toContain(message);
      expect(status).toHaveBeenCalledWith(expect.any(String), "error");
      expect(select).not.toHaveBeenCalled();
    },
  );
  it("parses the dev endpoint as an unknown boundary", () => {
    expect(
      parseLocalEffectCatalog({
        effects: [
          {
            default: true,
            source: '{"schemaVersion":"sniptale.effect.v1"}',
            sourceName: "soft-prism-wipe.sniptale-effect.json",
          },
          {
            default: false,
            source: "{}",
            sourceName: "../escaped.sniptale-effect.json",
          },
        ],
        errors: ["one diagnostic"],
      }),
    ).toEqual({
      effects: [
        {
          default: true,
          source: '{"schemaVersion":"sniptale.effect.v1"}',
          sourceName: "soft-prism-wipe.sniptale-effect.json",
        },
      ],
      errors: ["one diagnostic", "Local effect discovery entry 1 is invalid."],
    });
  });

  it("imports local effects without manual labels and selects the declared default", async () => {
    const ctx = createViewerContextFixture();
    vi.spyOn(ctx.deps, "loadLocalEffectCatalog").mockResolvedValue({
      effects: [
        {
          default: true,
          source: "materialized source",
          sourceName: "soft-prism-wipe.sniptale-effect.json",
        },
      ],
      errors: [],
    });
    ctx.deps.t = (key, fallback) => fallback ?? key;
    vi.spyOn(ctx, "importEffectFileSource").mockImplementation(
      async (_source, _sourceName, options) => {
        expect(options).toEqual({
          appendImportedLabel: false,
          preferOriginalId: true,
          select: false,
        });
        ctx.state.templates.push({ id: "soft-prism-wipe", duration: 1 });
        return { errors: [], ok: true, templateId: "soft-prism-wipe" };
      },
    );
    vi.spyOn(ctx, "logDiagnostic").mockImplementation(() => {});
    vi.spyOn(ctx, "populateTemplates").mockImplementation(() => {});
    const selectInitialTemplateWhenReady = vi
      .spyOn(ctx, "selectInitialTemplateWhenReady")
      .mockResolvedValue(undefined);
    const setPackStatus = vi
      .spyOn(ctx, "setPackStatus")
      .mockImplementation(() => {});
    ctx.state.assets.set("old", { id: "old" });
    ctx.state.baseAssets.set("old", { id: "old" });
    ctx.state.modules.set("old", {
      id: "old",
      path: "effects/old.sniptale-effect.json",
      document: createStarterDocument("old", "standalone"),
    });
    await expect(ctx.bootstrapLocalEffects()).resolves.toBe(true);

    expect(ctx.state.pack).toEqual({ packId: "sniptale.local-effects" });
    expect(ctx.state.assets.size).toBe(0);
    expect(ctx.state.baseAssets.size).toBe(0);
    expect(ctx.state.modules.size).toBe(0);
    expect(ctx.state.startupTemplateId).toBe("soft-prism-wipe");
    expect(requiredEntry(ctx.state.templates, 0)).toMatchObject({
      default: true,
    });
    expect(setPackStatus).toHaveBeenCalledWith(
      "Loaded 1 local effects",
      "ready",
    );
    expect(selectInitialTemplateWhenReady).toHaveBeenCalledOnce();
  });
});
