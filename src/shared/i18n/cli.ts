import type { Locale } from "./config.js";

const messages = {
  ru: {
    help: "Команды: init [папка], new <id> [--kind standalone|targetEffect|transition], validate <файл> [--asset-root папка], doctor, docs.\nОпции: --json, --locale ru|en, --help, --version.\nКоды завершения: 0 — успех, 1 — ошибка операции/валидации, 2 — неверные аргументы.\n",
    success: "Готово",
    failure: "Ошибка",
    browser:
      "Браузер не требуется для создания и валидации. Проверка браузера появится вместе с prove и studio.",
  },
  en: {
    help: "Commands: init [directory], new <id> [--kind standalone|targetEffect|transition], validate <file> [--asset-root directory], doctor, docs.\nOptions: --json, --locale ru|en, --help, --version.\nExit codes: 0 success, 1 operation/validation failure, 2 invalid arguments.\n",
    success: "Done",
    failure: "Error",
    browser:
      "No browser is needed to create or validate an effect. Browser checks will accompany prove and studio.",
  },
} satisfies Record<Locale, Record<string, string>>;

export function cliMessages(locale: Locale) {
  return messages[locale];
}
