import { describe, expect, it } from "vitest";

import {
  getTemplateArtifactTypeDescription,
  getTemplateArtifactTypeGroupLabel,
  getTemplateArtifactTypeLabel,
  resolveTemplateArtifactType,
} from "../src/apps/viewer/templates/artifact-type";
import {
  getTemplateBundleKindDescription,
  getTemplateBundleKindGroupLabel,
  getTemplateBundleKindLabel,
  resolveTemplateBundleKind,
} from "../src/apps/viewer/templates/bundle-kind";

describe("viewer template artifact type", () => {
  const translate = (_key: string, fallback: string) => fallback;

  it("maps transition effects to transition bundles", () => {
    const template = { kind: "transitionEffect" };

    expect(resolveTemplateArtifactType(template)).toBe("transition");
    expect(getTemplateArtifactTypeLabel(translate, template)).toBe(
      "Transition",
    );
    expect(getTemplateArtifactTypeDescription(translate, template)).toContain(
      "previous and next frames",
    );
    expect(getTemplateArtifactTypeGroupLabel(translate, "transition")).toBe(
      "Transitions",
    );
  });

  it.each(["composition", "overlay", "layerEffect", undefined])(
    "maps %s to an animation bundle",
    (kind) => {
      const template = { kind };

      expect(resolveTemplateArtifactType(template)).toBe("animation");
      expect(getTemplateArtifactTypeLabel(translate, template)).toBe(
        "Animation",
      );
      expect(getTemplateArtifactTypeDescription(translate, template)).toContain(
        "independent timeline",
      );
      expect(getTemplateArtifactTypeGroupLabel(translate, "animation")).toBe(
        "Animations",
      );
    },
  );
});

describe("viewer template bundle kind", () => {
  const translate = (_key: string, fallback: string) => fallback;

  it.each([
    ["standalone", "Standalone", "Standalone"],
    ["targetEffect", "Target effect", "Target effects"],
    ["transition", "Transition", "Transitions"],
  ])(
    "presents Effect v1 %s as its public role",
    (kind, expectedLabel, expectedGroup) => {
      const template = { effectV1: { kind } };
      const bundleKind = resolveTemplateBundleKind(template);

      expect(bundleKind).toBe(kind);
      expect(getTemplateBundleKindLabel(translate, template)).toBe(
        expectedLabel,
      );
      expect(getTemplateBundleKindGroupLabel(translate, bundleKind)).toBe(
        expectedGroup,
      );
      expect(getTemplateBundleKindDescription(translate, template)).not.toBe(
        "",
      );
    },
  );

  it("does not infer public roles from obsolete template kinds", () => {
    expect(resolveTemplateBundleKind({ kind: "transitionEffect" })).toBe(
      "standalone",
    );
  });
});
