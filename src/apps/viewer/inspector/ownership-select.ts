import { bindViewerAction } from "../app/bind-action.js";

import type { OwnershipSelectRow } from "./ownership-model.js";
import type { ViewerAppContext } from "../app/context.js";
function appendInspectorSelectRow(
  ctx: ViewerAppContext,
  { dataset = {}, label, onChange, options, value }: OwnershipSelectRow,
): void {
  const row = document.createElement("label");
  row.className = "inspector-row inspector-edit-row inspector-select-row";
  const name = document.createElement("span");
  name.textContent = label;
  const select = document.createElement("select");
  select.setAttribute("aria-label", label);
  Object.entries(dataset).forEach(([key, entryValue]) => {
    select.dataset[key] = String(entryValue);
  });
  for (const option of options) {
    const item = document.createElement("option");
    item.value = option.value;
    item.textContent = option.label;
    item.title = option.title ?? option.label;
    select.append(item);
  }
  select.value = value ?? "";
  syncInspectorSelectTitle(select);
  select.addEventListener("change", () => {
    syncInspectorSelectTitle(select);
    onChange(select.value);
  });
  row.append(name, select);
  ctx.appendInspectorNode(row);
}

function syncInspectorSelectTitle(select: HTMLSelectElement): void {
  const selected = select.selectedOptions[0];
  select.title = selected?.title || selected?.textContent?.trim() || "";
}

export function createOwnershipSelectActions(
  getContext: () => ViewerAppContext,
) {
  return {
    appendInspectorSelectRow: bindViewerAction(
      appendInspectorSelectRow,
      getContext,
    ),
  };
}
