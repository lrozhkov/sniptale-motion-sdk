import type { Locale } from "./config.js";

const messages = {
  ru: {
    help: "Команды: init [папка], new <id> [--kind standalone|targetEffect|transition], validate <файл> [--asset-root папка], export <файл> --output <файл> [--asset-root папка], studio [папка] [--no-open], doctor [--browser-channel chrome|msedge|chromium], browser install, docs.\nОпции: --json, --locale ru|en, --help, --version.\nКоды завершения: 0 — успех, 1 — ошибка операции/валидации, 2 — неверные аргументы.\n",
    studioReady: "Studio запущена. Откройте адрес в браузере:",
    studioStop: "Для остановки нажмите Ctrl+C.",
    browserOpenFailed:
      "Не удалось открыть браузер автоматически. Откройте адрес Studio вручную.",
    browserUnavailable:
      "Совместимый браузер не удалось запустить. Используйте установленный Chrome/Edge либо выполните sniptale-motion browser install для отдельной установки Chromium. На Linux также проверьте системные зависимости: https://playwright.dev/docs/browsers#install-system-dependencies",
    browserInstalling:
      "Устанавливается отдельный Chromium для Sniptale Motion. Требуется сеть; системный браузер не заменяется.",
    browserInstallFailed:
      "Установка Chromium не завершена. Проверьте сеть и доступ к каталогу браузеров, затем повторите sniptale-motion browser install.",
    success: "Готово",
    failure: "Ошибка",
    browser:
      "Браузер не требуется для создания и валидации. Studio использует установленный браузер. Browser proof пока недоступен.",
  },
  en: {
    help: "Commands: init [directory], new <id> [--kind standalone|targetEffect|transition], validate <file> [--asset-root directory], export <file> --output <file> [--asset-root directory], studio [directory] [--no-open], doctor [--browser-channel chrome|msedge|chromium], browser install, docs.\nOptions: --json, --locale ru|en, --help, --version.\nExit codes: 0 success, 1 operation/validation failure, 2 invalid arguments.\n",
    studioReady: "Studio is running. Open this address in a browser:",
    studioStop: "Press Ctrl+C to stop.",
    browserOpenFailed:
      "The browser could not be opened automatically. Open the Studio address manually.",
    browserUnavailable:
      "A compatible browser could not be started. Use installed Chrome/Edge or run sniptale-motion browser install to install separate Chromium. On Linux, also check system dependencies: https://playwright.dev/docs/browsers#install-system-dependencies",
    browserInstalling:
      "Installing separate Chromium for Sniptale Motion. This needs network access and does not replace your system browser.",
    browserInstallFailed:
      "Chromium installation did not finish. Check network access and browser directory permissions, then retry sniptale-motion browser install.",
    success: "Done",
    failure: "Error",
    browser:
      "No browser is needed to create or validate an effect. Studio uses your installed browser. Browser proof is not available yet.",
  },
} satisfies Record<Locale, Record<string, string>>;

export function cliMessages(locale: Locale) {
  return messages[locale];
}
