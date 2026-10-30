export const TEMPLATE_BUNDLE_KINDS = [
  "standalone",
  "dom",
  "targetEffect",
  "transition",
] as const;

export type TemplateBundleKind = (typeof TEMPLATE_BUNDLE_KINDS)[number];

export function resolveTemplateBundleKind(template: any): TemplateBundleKind {
  const kind = template?.domMotion ? "dom" : template?.effectV1?.kind;
  return TEMPLATE_BUNDLE_KINDS.includes(kind) ? kind : "standalone";
}

export function getTemplateBundleKindLabel(
  translate: (key: string, fallback: string) => string,
  template: any,
): string {
  const kind = resolveTemplateBundleKind(template);
  return translate(
    `viewer.templates.bundleKinds.${kind}`,
    BUNDLE_KIND_FALLBACKS[kind].label,
  );
}

export function getTemplateBundleKindGroupLabel(
  translate: (key: string, fallback: string) => string,
  kind: TemplateBundleKind,
): string {
  return translate(
    `viewer.templates.bundleKindGroups.${kind}`,
    BUNDLE_KIND_FALLBACKS[kind].group,
  );
}

export function getTemplateBundleKindDescription(
  translate: (key: string, fallback: string) => string,
  template: any,
): string {
  const kind = resolveTemplateBundleKind(template);
  return translate(
    `viewer.templates.bundleKindDescriptions.${kind}`,
    BUNDLE_KIND_FALLBACKS[kind].description,
  );
}

const BUNDLE_KIND_FALLBACKS: Record<
  TemplateBundleKind,
  { description: string; group: string; label: string }
> = {
  dom: {
    description: "A live HTML page assembled in perspective.",
    group: "HTML scenes",
    label: "HTML scene",
  },
  standalone: {
    description: "A self-contained scene with its own timeline.",
    group: "Standalone",
    label: "Standalone",
  },
  targetEffect: {
    description: "An effect applied to temporary source image or video.",
    group: "Target effects",
    label: "Target effect",
  },
  transition: {
    description: "A transition between temporary from and to media.",
    group: "Transitions",
    label: "Transition",
  },
};
