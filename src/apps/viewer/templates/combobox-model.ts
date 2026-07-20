export type TemplateComboboxEntry = {
  description: string;
  group: string;
  label: string;
  value: string;
};

export function normalizeTemplateSearch(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();
}

export function filterTemplateComboboxEntries(
  entries: TemplateComboboxEntry[],
  query: unknown,
): TemplateComboboxEntry[] {
  const tokens = normalizeTemplateSearch(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return entries;
  }
  return entries.filter((entry) => {
    const searchable = normalizeTemplateSearch(
      [entry.label, entry.value, entry.group, entry.description].join(" "),
    );
    return tokens.every((token) => searchable.includes(token));
  });
}
