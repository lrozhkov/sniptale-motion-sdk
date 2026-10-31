import type { EditorText } from "../templates/model.js";
import type { OwnershipOption } from "./ownership-model.js";

export function createOwnershipOptions(
  items: readonly { id: string; label?: EditorText }[],
  emptyLabel: string,
  resolveText: (text: EditorText | undefined, fallback: string) => string,
): OwnershipOption[] {
  const labels = items.map((item) => ({
    id: item.id,
    label: resolveText(item.label, item.id) || item.id,
  }));
  const counts = new Map<string, number>();
  for (const { label } of labels)
    counts.set(label, (counts.get(label) ?? 0) + 1);
  return [
    { label: emptyLabel, title: emptyLabel, value: "" },
    ...labels.map(({ id, label }) => {
      const title = label === id ? label : `${label} (${id})`;
      return {
        label: (counts.get(label) ?? 0) > 1 ? title : label,
        title,
        value: id,
      };
    }),
  ];
}
