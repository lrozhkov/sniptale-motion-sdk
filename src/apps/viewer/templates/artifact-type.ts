import type { EffectArtifactType } from "../../../sdk/types.js";

export function resolveTemplateArtifactType(template: any): EffectArtifactType {
  return template?.kind === "transitionEffect" ? "transition" : "animation";
}

export function getTemplateArtifactTypeLabel(
  translate: (key: string, fallback: string) => string,
  template: any,
): string {
  const type = resolveTemplateArtifactType(template);
  return translate(
    `viewer.templates.artifactTypes.${type}`,
    type === "transition" ? "Transition" : "Animation",
  );
}

export function getTemplateArtifactTypeGroupLabel(
  translate: (key: string, fallback: string) => string,
  type: EffectArtifactType,
): string {
  return translate(
    `viewer.templates.artifactTypeGroups.${type}`,
    type === "transition" ? "Transitions" : "Animations",
  );
}

export function getTemplateArtifactTypeDescription(
  translate: (key: string, fallback: string) => string,
  template: any,
): string {
  const type = resolveTemplateArtifactType(template);
  return translate(
    `viewer.templates.artifactDescriptions.${type}`,
    type === "transition"
      ? "Blends previous and next frames at a transition boundary."
      : "Renders an independent timeline animation.",
  );
}
