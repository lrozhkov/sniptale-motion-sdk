import { describe, expect, it, vi } from "vitest";

import { parseLocalEffectCatalog } from "../src/apps/viewer/effect-file/local-catalog";
import { createLocalEffectStartupActions } from "../src/apps/viewer/effect-file/local-startup";

describe("viewer local effect startup", () => {
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
    const ctx: any = {
      deps: {
        loadLocalEffectCatalog: vi.fn(async () => ({
          effects: [
            {
              default: true,
              source: "materialized source",
              sourceName: "soft-prism-wipe.sniptale-effect.json",
            },
          ],
          errors: [],
        })),
        t: (_key, fallback) => fallback,
      },
      importEffectFileSource: vi.fn(async (_source, _sourceName, options) => {
        expect(options).toEqual({
          appendImportedLabel: false,
          preferOriginalId: true,
          select: false,
        });
        ctx.state.templates.push({ id: "soft-prism-wipe" });
        return { errors: [], ok: true, templateId: "soft-prism-wipe" };
      }),
      logDiagnostic: vi.fn(),
      populateTemplates: vi.fn(),
      selectInitialTemplateWhenReady: vi.fn(),
      setPackStatus: vi.fn(),
      state: {
        assets: new Map([["old", {}]]),
        baseAssets: new Map([["old", {}]]),
        modules: new Map([["old", {}]]),
        pack: null,
        startupTemplateId: null,
        templates: [],
      },
    };
    Object.assign(
      ctx,
      createLocalEffectStartupActions(() => ctx),
    );

    await expect(ctx.bootstrapLocalEffects()).resolves.toBe(true);

    expect(ctx.state.pack).toEqual({ packId: "sniptale.local-effects" });
    expect(ctx.state.startupTemplateId).toBe("soft-prism-wipe");
    expect(ctx.state.templates[0]).toMatchObject({ default: true });
    expect(ctx.setPackStatus).toHaveBeenCalledWith(
      "Loaded 1 local effects",
      "ready",
    );
    expect(ctx.selectInitialTemplateWhenReady).toHaveBeenCalledOnce();
  });
});
