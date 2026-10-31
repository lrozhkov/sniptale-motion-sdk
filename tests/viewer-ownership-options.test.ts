import { afterEach, describe, expect, it } from "vitest";
import { createOwnershipOptions } from "../src/apps/viewer/inspector/ownership-options.js";
import { setLocale, translateText } from "../src/shared/i18n/index.js";

afterEach(() => {
  setLocale("ru");
});

describe("ownership option labels", () => {
  it("uses the active locale and keeps duplicate labels distinguishable by identity", () => {
    const items = [
      { id: "intro", label: { ru: "Сцена", en: "Scene" } },
      { id: "outro", label: { ru: "Сцена", en: "Scene" } },
    ];
    setLocale("ru");
    expect(createOwnershipOptions(items, "Авто", translateText)).toEqual([
      { label: "Авто", title: "Авто", value: "" },
      { label: "Сцена (intro)", title: "Сцена (intro)", value: "intro" },
      { label: "Сцена (outro)", title: "Сцена (outro)", value: "outro" },
    ]);
    setLocale("en");
    expect(createOwnershipOptions(items, "Auto", translateText)).toEqual([
      { label: "Auto", title: "Auto", value: "" },
      { label: "Scene (intro)", title: "Scene (intro)", value: "intro" },
      { label: "Scene (outro)", title: "Scene (outro)", value: "outro" },
    ]);
  });

  it("uses the identifier for absent or empty labels and preserves the clear option", () => {
    expect(
      createOwnershipOptions(
        [{ id: "intro" }, { id: "outro", label: "" }],
        "Auto",
        translateText,
      ),
    ).toEqual([
      { label: "Auto", title: "Auto", value: "" },
      { label: "intro", title: "intro", value: "intro" },
      { label: "outro", title: "outro", value: "outro" },
    ]);
  });
});
