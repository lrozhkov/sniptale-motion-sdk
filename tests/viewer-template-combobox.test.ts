import { describe, expect, it } from "vitest";
import {
  filterTemplateComboboxEntries,
  normalizeTemplateSearch,
  type TemplateComboboxEntry,
} from "../src/apps/viewer/templates/combobox-model";

const entries: TemplateComboboxEntry[] = [
  {
    description: "Композиция · Анимация · neutral-intro",
    group: "Композиции",
    label: "Neutral intro / outro",
    value: "neutral-intro",
  },
  {
    description: "Переход · transition-grid",
    group: "Переходы",
    label: "Grid reveal",
    value: "transition-grid",
  },
];

describe("viewer template combobox model", () => {
  it("normalizes case and diacritics for human search", () => {
    expect(normalizeTemplateSearch("  RévéAL  ")).toBe("reveal");
  });

  it("matches every token across label, id, type, and group metadata", () => {
    expect(
      filterTemplateComboboxEntries(entries, "neutral анимация").map(
        (entry) => entry.value,
      ),
    ).toEqual(["neutral-intro"]);
    expect(
      filterTemplateComboboxEntries(entries, "переход grid").map(
        (entry) => entry.value,
      ),
    ).toEqual(["transition-grid"]);
  });

  it("keeps source order for an empty query and rejects partial token sets", () => {
    expect(filterTemplateComboboxEntries(entries, "")).toEqual(entries);
    expect(
      filterTemplateComboboxEntries(entries, "neutral transition"),
    ).toEqual([]);
  });
});
