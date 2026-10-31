import { describe, expect, it } from "vitest";
import {
  EFFECT_V1_CONTROL_ICONS,
  EFFECT_V1_CONTROL_UNITS,
  normalizeEffectV1ToTemplate,
  resolveEffectV1ControlGroup,
  validateEffectV1Document,
  validateEffectV1ControlPresetValues,
} from "../src/sdk/effect-v1/index.js";
import { buildEffectFilePayload } from "../src/apps/viewer/effect-file/builder.js";
import {
  createControlPresentationDocument,
  createControlPresentationFixtures,
} from "../tooling/test/fixtures/control-presentation.js";
import { requireEffectV1Fixture } from "../tooling/test/fixtures/effect-v1-documents.js";
import { requiredEntry } from "./helpers/required-entry.js";

describe("Effect v1 control metadata", () => {
  const fixtures = createControlPresentationFixtures();
  it.each(fixtures.filter((fixture) => fixture.diagnostic === undefined))(
    "accepts $id without diagnostics",
    (fixture) => {
      const result = validateEffectV1Document(fixture.document);
      expect(result.ok).toBe(true);
      expect(result.diagnostics).toEqual([]);
    },
  );
  const diagnosticFixtures = fixtures.flatMap((fixture) =>
    fixture.diagnostic === undefined
      ? []
      : [{ ...fixture, diagnostic: fixture.diagnostic }],
  );
  it.each(diagnosticFixtures)(
    "validates $id at its declared boundary",
    (fixture) => {
      const result = validateEffectV1Document(fixture.document);
      expect(result.ok).toBe(fixture.accepted);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining(fixture.diagnostic),
      );
    },
  );

  it("preserves group and option metadata through normalization and portable export", () => {
    const document = createControlPresentationDocument();
    const before = structuredClone(document);
    const template = normalizeEffectV1ToTemplate(
      requireEffectV1Fixture(document),
    );
    const exported = requireEffectV1Fixture(
      buildEffectFilePayload({ template, assets: new Map() }),
    );
    expect(exported.controlGroups).toEqual(document.controlGroups);
    expect(exported.controls).toEqual(document.controls);
    expect(exported.program).toEqual(document.program);
    expect(document).toEqual(before);
    expect(template.controlGroups).not.toBe(document.controlGroups);
    expect(requiredEntry(exported.controls, 0).defaultValue).toBe(20);
  });

  it.each(EFFECT_V1_CONTROL_UNITS)(
    "does not rescale %s control values",
    (unit) => {
      const document = createControlPresentationDocument();
      requiredEntry(document.controls, 0).unit = unit;
      expect(validateEffectV1Document(document).ok).toBe(true);
      const template = normalizeEffectV1ToTemplate(document);
      expect(requiredEntry(template.controls ?? [], 0).defaultValue).toBe(20);
    },
  );

  it("has a unique finite icon registry", () => {
    expect(EFFECT_V1_CONTROL_ICONS).toHaveLength(44);
    expect(new Set(EFFECT_V1_CONTROL_ICONS).size).toBe(44);
  });

  it.each(["content", "geometry"])(
    "resolves semantic ancestors without granting %s visual preset access",
    (semanticGroup) => {
      const document = createControlPresentationDocument();
      expect(
        resolveEffectV1ControlGroup("detail", document.controlGroups),
      ).toBe("appearance");
      expect(
        validateEffectV1ControlPresetValues(document, { amount: 25 }).ok,
      ).toBe(true);
      requiredEntry(document.controlGroups ?? [], 0).parentId = semanticGroup;
      expect(
        resolveEffectV1ControlGroup("detail", document.controlGroups),
      ).toBe(semanticGroup);
      const result = validateEffectV1ControlPresetValues(document, {
        amount: 25,
      });
      expect(result.ok).toBe(false);
      expect(result.diagnostics.map((item) => item.code)).toContain(
        "CONTROL_PRESET_PROTECTED",
      );
    },
  );

  it("fails closed for ambiguous, cyclic and over-deep ancestors", () => {
    const label = { en: "Group" };
    for (const groups of [
      [{ id: "child", parentId: "missing", label }],
      [{ id: "child", parentId: "child", label }],
      [
        { id: "child", parentId: "appearance", label },
        { id: "child", parentId: "geometry", label },
      ],
      [
        { id: "child", parentId: "two", label },
        { id: "two", parentId: "three", label },
        { id: "three", parentId: "four", label },
        { id: "four", parentId: "appearance", label },
      ],
    ])
      expect(resolveEffectV1ControlGroup("child", groups)).toBeNull();
  });
});
