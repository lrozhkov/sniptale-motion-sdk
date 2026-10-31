import type { Locale } from "./config.js";

const messages = {
  ru: {
    help: "Команды: init [папка], new <id> [--kind standalone|targetEffect|transition], validate <файл> [--asset-root папка] [--authoring], prove <файл> [--asset-root папка] [--browser-channel chrome|msedge|chromium], export <файл> --output <файл> [--asset-root папка], studio [папка] [--no-open], doctor [--project path] [--browser-channel chrome|msedge|chromium], browser install, skills, check-update [version] [--project path], docs.\nОпции: --json, --locale ru|en, --help, --version.\nКоды завершения: 0 — успех, 1 — ошибка операции/валидации, 2 — неверные аргументы.\n",
    studioReady: "Studio запущена. Откройте адрес в браузере:",
    skillKitFailed:
      "Набор skill не соответствует установленному toolkit или повреждён. Переустановите проверенный архив и повторите skills.",
    projectVersion:
      "Формат проекта, Effect schema или поколение совместимости не поддерживается. Данные не изменены; используйте подходящий toolkit либо отдельную явную миграцию с резервной копией.",
    projectRequired:
      "Не найден читаемый проект Sniptale Motion. Перейдите в его папку или создайте новый через init; существующий manifest не перезаписывается.",
    updateVersion:
      "Укажите точную версию пакета, например check-update 0.2.0, без диапазонов и dist-tag.",
    updateRegistryFailed:
      "Не удалось проверить метаданные обновления. Проверьте сеть и повторите check-update; установленный toolkit и проект не изменены.",
    studioStop: "Для остановки нажмите Ctrl+C.",
    browserOpenFailed:
      "Не удалось открыть браузер автоматически. Откройте адрес Studio вручную.",
    browserUnavailable:
      "Совместимый браузер не удалось запустить. Используйте установленный Chrome/Edge либо выполните sniptale-motion browser install для отдельной установки Chromium. На Linux также проверьте системные зависимости: https://playwright.dev/docs/browsers#install-system-dependencies",
    browserInstalling:
      "Устанавливается отдельный Chromium для Sniptale Motion. Требуется сеть; системный браузер не заменяется.",
    browserInstallFailed:
      "Установка Chromium не завершена. Проверьте сеть и доступ к каталогу браузеров, затем повторите sniptale-motion browser install.",
    proofFailed:
      "Browser proof не завершён: импорт, рендер или ожидание кадра завершились ошибкой. Проверьте эффект командой validate и откройте его в Studio для диагностики.",
    proofSourceTooLarge:
      "Материализованный эффект превышает поддерживаемый размер документа viewer. Уменьшите размер ассетов и повторите prove.",
    proofCleanupFailed:
      "Не удалось полностью закрыть ресурсы browser proof. Проверьте локальные процессы перед повторным запуском.",
    controlUnitLabel:
      "Единица числового параметра должна храниться в unit отдельно от подписи.",
    controlUnitSuggestion:
      "Задайте соответствующую unit и уберите единицу из label. Не меняйте числовые значения и диапазоны.",
    invalidJson:
      "Документ содержит невалидный JSON. Проверьте синтаксис: кавычки, запятые и скобки.",
    unknownField: "Поле не поддерживается форматом Effect v1.",
    invalidCommand: "Команда рендера не поддерживается форматом Effect v1.",
    invalidExpression:
      "Операция выражения не поддерживается форматом Effect v1.",
    validationFailed:
      "Поле не соответствует контракту Effect v1; причина указана в code.",
    validationSuggestion:
      "Проверьте указанное поле по поставляемой schemas/sniptale-effect-v1.schema.json и инструкции docs, затем повторите validate.",
    assetValidationFailed:
      "Не удалось безопасно прочитать или проверить ассет. Проверьте путь, формат, размер и контрольную сумму указанного поля.",
    operationFailed:
      "Операция не завершена. Проверьте аргументы, наличие файлов и права доступа; причина указана в коде ошибки.",
    success: "Готово",
    failure: "Ошибка",
    browser:
      "Браузер не требуется для создания и валидации. Studio использует установленный браузер; prove запускает совместимый браузер без интерфейса.",
  },
  en: {
    help: "Commands: init [directory], new <id> [--kind standalone|targetEffect|transition], validate <file> [--asset-root directory] [--authoring], prove <file> [--asset-root directory] [--browser-channel chrome|msedge|chromium], export <file> --output <file> [--asset-root directory], studio [directory] [--no-open], doctor [--project path] [--browser-channel chrome|msedge|chromium], browser install, skills, check-update [version] [--project path], docs.\nOptions: --json, --locale ru|en, --help, --version.\nExit codes: 0 success, 1 operation/validation failure, 2 invalid arguments.\n",
    studioReady: "Studio is running. Open this address in a browser:",
    skillKitFailed:
      "The skill kit does not match the installed toolkit or is damaged. Reinstall the verified archive and run skills again.",
    projectVersion:
      "The project format, Effect schema or compatibility generation is unsupported. Data was not changed; use a matching toolkit or a separate explicit migration with a backup.",
    projectRequired:
      "No readable Sniptale Motion project was found. Enter its directory or create a new one with init; an existing manifest is never replaced.",
    updateVersion:
      "Specify an exact package version, for example check-update 0.2.0, without ranges or dist-tags.",
    updateRegistryFailed:
      "Update metadata could not be verified. Check network access and retry check-update; the installed toolkit and project were not changed.",
    studioStop: "Press Ctrl+C to stop.",
    browserOpenFailed:
      "The browser could not be opened automatically. Open the Studio address manually.",
    browserUnavailable:
      "A compatible browser could not be started. Use installed Chrome/Edge or run sniptale-motion browser install to install separate Chromium. On Linux, also check system dependencies: https://playwright.dev/docs/browsers#install-system-dependencies",
    browserInstalling:
      "Installing separate Chromium for Sniptale Motion. This needs network access and does not replace your system browser.",
    browserInstallFailed:
      "Chromium installation did not finish. Check network access and browser directory permissions, then retry sniptale-motion browser install.",
    proofFailed:
      "Browser proof did not finish: import, rendering or waiting for a frame failed. Run validate and open the effect in Studio for diagnosis.",
    proofSourceTooLarge:
      "The materialized effect exceeds the viewer document size limit. Reduce the assets and run prove again.",
    proofCleanupFailed:
      "Browser proof resources could not be closed completely. Check local processes before retrying.",
    controlUnitLabel:
      "Keep numeric control units in unit, separate from the label.",
    controlUnitSuggestion:
      "Declare the matching unit and remove the unit from label. Preserve numeric values and ranges.",
    invalidJson:
      "The document contains invalid JSON. Check quotes, commas and brackets.",
    unknownField: "The field is not supported by Effect v1.",
    invalidCommand: "The render command is not supported by Effect v1.",
    invalidExpression:
      "The expression operation is not supported by Effect v1.",
    validationFailed:
      "The field does not match the Effect v1 contract; code identifies the reason.",
    validationSuggestion:
      "Check the field against the supplied schemas/sniptale-effect-v1.schema.json and docs, then run validate again.",
    assetValidationFailed:
      "The asset could not be read or verified safely. Check the field's path, format, size and checksum.",
    operationFailed:
      "The operation did not finish. Check arguments, files and access permissions; the error code identifies the reason.",
    success: "Done",
    failure: "Error",
    browser:
      "No browser is needed to create or validate an effect. Studio uses your installed browser; prove starts a compatible browser headlessly.",
  },
} satisfies Record<Locale, Record<string, string>>;

export function cliMessages(locale: Locale) {
  return messages[locale];
}
