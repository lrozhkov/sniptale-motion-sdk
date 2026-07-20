import type { ViewerAppContext } from "../app/context.js";
import {
  filterTemplateComboboxEntries,
  type TemplateComboboxEntry,
} from "./combobox-model.js";

function getSourceOptions(ctx: ViewerAppContext): HTMLOptionElement[] {
  return Array.from(ctx.refs.templateSelect.options as HTMLOptionsCollection);
}

function readEntries(ctx: ViewerAppContext): TemplateComboboxEntry[] {
  return getSourceOptions(ctx)
    .filter((option) => option.value && !option.disabled)
    .map((option) => ({
      description: option.title,
      group:
        option.parentElement instanceof HTMLOptGroupElement
          ? option.parentElement.label
          : "",
      label: option.textContent?.trim() || option.value,
      value: option.value,
    }));
}

function getRenderedOptions(ctx: ViewerAppContext): HTMLElement[] {
  const listbox = ctx.refs.templateComboboxListbox as HTMLElement;
  return Array.from(
    listbox.querySelectorAll<HTMLElement>(".template-combobox-option"),
  );
}

function setActiveValue(
  ctx: ViewerAppContext,
  value: string | null,
  scroll = false,
): void {
  const options = getRenderedOptions(ctx);
  const active = options.find((option) => option.dataset.value === value);
  for (const option of options) {
    option.classList.toggle("active", option === active);
  }
  ctx.refs.templateCombobox.dataset.activeValue = active?.dataset.value ?? "";
  ctx.refs.templateComboboxSearch.toggleAttribute(
    "aria-activedescendant",
    Boolean(active),
  );
  if (active) {
    ctx.refs.templateComboboxSearch.setAttribute(
      "aria-activedescendant",
      active.id,
    );
    if (scroll) {
      active.scrollIntoView({ block: "nearest" });
    }
  }
}

function selectValue(ctx: ViewerAppContext, value: string): void {
  const option = getSourceOptions(ctx).find(
    (candidate) => candidate.value === value,
  );
  if (!option) {
    return;
  }
  ctx.refs.templateSelect.value = value;
  ctx.refs.templateComboboxValue.textContent =
    option.textContent?.trim() || option.value;
  ctx.setTemplateComboboxOpen(false);
  ctx.refs.templateComboboxButton.focus();
  ctx.refs.templateSelect.dispatchEvent(new Event("change", { bubbles: true }));
}

function renderResults(ctx: ViewerAppContext, query = ""): void {
  const entries = filterTemplateComboboxEntries(readEntries(ctx), query);
  const selectedValue = ctx.refs.templateSelect.value;
  const groups = new Map<string, HTMLElement>();
  ctx.refs.templateComboboxListbox.replaceChildren();
  for (const [index, entry] of entries.entries()) {
    const groupName =
      entry.group || ctx.deps.t("viewer.templates.other", "Other");
    let group = groups.get(groupName);
    if (!group) {
      group = document.createElement("div");
      group.className = "template-combobox-group";
      group.setAttribute("role", "group");
      const heading = document.createElement("span");
      heading.className = "template-combobox-group-label";
      heading.id = `templateComboboxGroup-${groups.size}`;
      heading.textContent = groupName;
      group.setAttribute("aria-labelledby", heading.id);
      group.append(heading);
      groups.set(groupName, group);
      ctx.refs.templateComboboxListbox.append(group);
    }
    const option = document.createElement("button");
    option.className = "template-combobox-option";
    option.classList.toggle("selected", entry.value === selectedValue);
    option.dataset.value = entry.value;
    option.id = `templateComboboxOption-${index}`;
    option.type = "button";
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", String(entry.value === selectedValue));
    option.tabIndex = -1;
    const label = document.createElement("strong");
    label.textContent = entry.label;
    option.append(label);
    option.addEventListener("pointerdown", (event) => event.preventDefault());
    option.addEventListener("click", () => selectValue(ctx, entry.value));
    option.addEventListener("pointermove", () =>
      setActiveValue(ctx, entry.value),
    );
    group.append(option);
  }
  ctx.refs.templateComboboxEmpty.hidden = entries.length > 0;
  const activeValue = entries.find(
    (entry) => entry.value === selectedValue,
  )?.value;
  setActiveValue(ctx, activeValue ?? entries[0]?.value ?? null);
}

function syncTemplateCombobox(ctx: ViewerAppContext): void {
  const entries = readEntries(ctx);
  const selected = getSourceOptions(ctx).find(
    (option) =>
      option.value === ctx.refs.templateSelect.value && !option.disabled,
  );
  ctx.refs.templateComboboxButton.disabled = entries.length === 0;
  ctx.refs.templateComboboxValue.textContent = selected
    ? selected.textContent?.trim() || selected.value
    : ctx.refs.templateSelect.selectedOptions[0]?.textContent?.trim() || "";
  ctx.refs.templateComboboxButton.title = ctx.refs.templateSelect.title;
  ctx.setTemplateComboboxOpen(false);
}

function setTemplateComboboxOpen(ctx: ViewerAppContext, open: boolean): void {
  const canOpen = open && !ctx.refs.templateComboboxButton.disabled;
  ctx.refs.templateCombobox.classList.toggle("open", canOpen);
  ctx.refs.templateComboboxButton.setAttribute(
    "aria-expanded",
    String(canOpen),
  );
  ctx.refs.templateComboboxPopup.hidden = !canOpen;
  ctx.refs.templateComboboxListbox.hidden = !canOpen;
  ctx.refs.templateCombobox.dataset.activeValue = "";
  ctx.refs.templateComboboxSearch.removeAttribute("aria-activedescendant");
  if (!canOpen) {
    ctx.refs.templateComboboxSearch.value = "";
    return;
  }
  ctx.refs.templateComboboxSearch.value = "";
  renderResults(ctx);
  ctx.refs.templateComboboxSearch.focus();
}

function moveActiveOption(ctx: ViewerAppContext, direction: number): void {
  const options = getRenderedOptions(ctx);
  if (options.length === 0) {
    return;
  }
  const activeIndex = options.findIndex(
    (option) =>
      option.dataset.value === ctx.refs.templateCombobox.dataset.activeValue,
  );
  const nextIndex =
    activeIndex < 0
      ? direction > 0
        ? 0
        : options.length - 1
      : (activeIndex + direction + options.length) % options.length;
  setActiveValue(ctx, options[nextIndex].dataset.value ?? null, true);
}

function handleSearchKeydown(
  ctx: ViewerAppContext,
  event: KeyboardEvent,
): void {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    moveActiveOption(ctx, event.key === "ArrowDown" ? 1 : -1);
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    const activeValue = ctx.refs.templateCombobox.dataset.activeValue;
    if (activeValue) {
      selectValue(ctx, activeValue);
    }
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    ctx.setTemplateComboboxOpen(false);
    ctx.refs.templateComboboxButton.focus();
  }
}

function wireTemplateCombobox(ctx: ViewerAppContext): void {
  ctx.refs.templateComboboxButton.addEventListener("click", () =>
    ctx.setTemplateComboboxOpen(ctx.refs.templateComboboxPopup.hidden),
  );
  ctx.refs.templateComboboxButton.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "Enter") {
      event.preventDefault();
      ctx.setTemplateComboboxOpen(true);
    }
  });
  ctx.refs.templateComboboxSearch.addEventListener("input", () =>
    renderResults(ctx, ctx.refs.templateComboboxSearch.value),
  );
  ctx.refs.templateComboboxSearch.addEventListener("keydown", (event) =>
    handleSearchKeydown(ctx, event),
  );
  document.addEventListener("pointerdown", (event) => {
    if (
      !ctx.refs.templateComboboxPopup.hidden &&
      event.target instanceof Node &&
      !ctx.refs.templateCombobox.contains(event.target)
    ) {
      ctx.setTemplateComboboxOpen(false);
    }
  });
}

export function installTemplatesComboboxOwner(ctx: ViewerAppContext): void {
  ctx.setTemplateComboboxOpen = (...args: any[]) =>
    (setTemplateComboboxOpen as any)(ctx, ...args);
  ctx.syncTemplateCombobox = (...args: any[]) =>
    (syncTemplateCombobox as any)(ctx, ...args);
  ctx.wireTemplateCombobox = (...args: any[]) =>
    (wireTemplateCombobox as any)(ctx, ...args);
}
