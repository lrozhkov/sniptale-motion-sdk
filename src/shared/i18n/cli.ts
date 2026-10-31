import type { Locale } from "./config.js";

const messages = {
  ru: {
    help: "Команды: init [папка], new <id> [--kind standalone|targetEffect|transition], validate <файл> [--asset-root папка], export <файл> --output <файл> [--asset-root папка], studio [папка] [--no-open], doctor, docs.\nОпции: --json, --locale ru|en, --help, --version.\nКоды завершения: 0 — успех, 1 — ошибка операции/валидации, 2 — неверные аргументы.\n",
    studioReady: "Studio запущена. Откройте адрес в браузере:",
    studioStop: "Для остановки нажмите Ctrl+C.",
    browserOpenFailed:
      "Не удалось открыть браузер автоматически. Откройте адрес Studio вручную.",
    success: "Готово",
    failure: "Ошибка",
    browser:
      "Браузер не требуется для создания и валидации. Studio использует установленный браузер. Browser proof пока недоступен.",
  },
  en: {
    help: "Commands: init [directory], new <id> [--kind standalone|targetEffect|transition], validate <file> [--asset-root directory], export <file> --output <file> [--asset-root directory], studio [directory] [--no-open], doctor, docs.\nOptions: --json, --locale ru|en, --help, --version.\nExit codes: 0 success, 1 operation/validation failure, 2 invalid arguments.\n",
    studioReady: "Studio is running. Open this address in a browser:",
    studioStop: "Press Ctrl+C to stop.",
    browserOpenFailed:
      "The browser could not be opened automatically. Open the Studio address manually.",
    success: "Done",
    failure: "Error",
    browser:
      "No browser is needed to create or validate an effect. Studio uses your installed browser. Browser proof is not available yet.",
  },
} satisfies Record<Locale, Record<string, string>>;

export function cliMessages(locale: Locale) {
  return messages[locale];
}
