import { resolveEffectV1ControlGroupIcons } from "../../../sdk/effect-v1/control-group-icons.js";
import {
  EFFECT_V1_CONTROL_GROUPS,
  EFFECT_V1_CONTROL_ROOT_ICONS,
  resolveEffectV1ControlGroup,
  isEffectV1SemanticControlGroup,
} from "../../../sdk/effect-v1/control-presentation-model.js";
import type { EditorTemplateSource } from "../templates/model.js";
import type { ControlPresentationLocale } from "./control-fields.js";
import { createControlIcon } from "./control-icons.js";

/** Only render populated branches; unknown legacy groups use Advanced. */
export function createControlGroupContainers(
  panel: HTMLElement,
  template: EditorTemplateSource,
  locale: ControlPresentationLocale,
): Map<string, HTMLElement> {
  const groups = template.controlGroups ?? [];
  const definitions = new Map(groups.map((group) => [group.id, group]));
  const acceptedIcons = resolveEffectV1ControlGroupIcons(
    groups,
    template.controls,
  );
  const icons = new Map(
    groups.map((group, index) => [group.id, acceptedIcons.get(index)]),
  );
  const occupied = new Set<string>();
  for (const control of template.controls ?? []) {
    const root =
      resolveEffectV1ControlGroup(control.group, groups) ?? "advanced";
    occupied.add(root);
    let id = control.group ?? root;
    // The shared resolver rejects malformed and cyclic hierarchies before traversal.
    if (resolveEffectV1ControlGroup(id, groups) === null) continue;
    for (let depth = 0; depth < 4 && definitions.has(id); depth += 1) {
      occupied.add(id);
      const group = definitions.get(id);
      if (!group) break;
      id = group.parentId;
    }
  }
  const containers = new Map<string, HTMLElement>();
  function appendGroup(parent: HTMLElement, id: string): void {
    const definition = definitions.get(id);
    const details = document.createElement("details");
    details.className = "control-group";
    details.dataset.controlGroup = id;
    details.open = !definition?.collapsed;
    const summary = document.createElement("summary");
    const icon =
      icons.get(id) ??
      (isEffectV1SemanticControlGroup(id)
        ? EFFECT_V1_CONTROL_ROOT_ICONS[id]
        : undefined);
    if (icon) summary.append(createControlIcon(icon));
    summary.append(
      document.createTextNode(
        definition
          ? locale.translateText(definition.label, id)
          : locale.t(`viewer.controls.groups.${id}`),
      ),
    );
    const content = document.createElement("div");
    content.className = "control-group-content";
    details.append(summary, content);
    parent.append(details);
    containers.set(id, content);
    for (const child of groups
      .filter((group) => group.parentId === id && occupied.has(group.id))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
      appendGroup(content, child.id);
  }
  for (const root of EFFECT_V1_CONTROL_GROUPS)
    if (occupied.has(root)) appendGroup(panel, root);
  return containers;
}
