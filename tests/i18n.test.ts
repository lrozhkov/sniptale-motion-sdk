import { describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, FALLBACK_LOCALE } from "../src/shared/i18n/config";
import { getLocale, setLocale, t, translateText } from "../src/shared/i18n";

describe("i18n runtime contract", () => {
  it("keeps Russian as source locale and English as required fallback", () => {
    expect(DEFAULT_LOCALE).toBe("ru");
    expect(FALLBACK_LOCALE).toBe("en");
  });

  it("resolves locale text through requested, Russian, English, and fallback key order", () => {
    setLocale("en");
    expect(getLocale()).toBe("en");
    expect(translateText({ en: "English", ru: "Русский" }, "fallback")).toBe(
      "English",
    );

    setLocale("ru");
    expect(translateText({ en: "English" }, "fallback")).toBe("English");
    expect(translateText(null, "fallback")).toBe("fallback");
    expect(t("viewer.timeline.linkedKeys")).toBe("Связанные ключи");
    expect(t("viewer.assets.addLayer")).toBe("Добавить слой");
    expect(t("viewer.mp4Export.title")).toBe("Экспорт MP4");
    expect(t("viewer.mp4Export.audioCodec")).toBe("Аудиокодек");
    expect(t("viewer.templates.bundleKinds.targetEffect")).toBe(
      "Эффект на медиа",
    );
    expect(t("viewer.renderer.affectsCurrentFrame")).toBe(
      "Влияет на текущий кадр",
    );
    expect(t("viewer.validation.issueCount")).toBe("Проблем проверки: {count}");
    expect(t("viewer.validation.messages.clipOutsideEffect")).toBe(
      "Клип «{clip}» выходит за длительность эффекта",
    );
    expect(t("viewer.validation.messages.rendererTrackGate")).toContain(
      "Нарушение контракта рендерера",
    );
    expect(t("viewer.selection.types.layer")).toBe("Слой");
    expect(t("viewer.selection.types.preset")).toBe("Пресет");
    expect(t("viewer.timeline.durationShort")).toBe("Длит.");
    expect(t("viewer.timeline.snapTenth")).toBe("0.1с");
    expect(t("viewer.time.secondsUnit")).toBe("с");
    expect(t("viewer.inspector.layerOptions.blendMode.source-over")).toBe(
      "Обычный",
    );
    expect(t("viewer.inspector.layerOptions.svgPartMode.scatter")).toBe(
      "Разлёт",
    );
    expect(t("viewer.inspector.layerOptions.partOrder.document")).toBe(
      "По порядку в SVG",
    );
  });
});
