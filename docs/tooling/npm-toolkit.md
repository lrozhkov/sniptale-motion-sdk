# Sniptale Motion

Локальный комплект для создания и проверки декларативных эффектов Sniptale Effect v1. Это промежуточный кандидат для проверки установки: Studio, browser proof, экспорт и установка skill ещё не входят в доступные команды. Пакет не опубликован; полный strict и платформенная приёмка ещё не завершены.

Нужны Node.js 22.12 или новее и npm. Установите полученный архив командой `npm install --global /полный/путь/sniptale-motion-0.1.0.tgz`. Репозиторий и инструменты разработки для работы не нужны. Установка не загружает браузер и не запускает lifecycle-скрипты пакета.

Выполните `sniptale-motion --help`, затем `sniptale-motion doctor`. Создайте рабочую папку командой `sniptale-motion init my-motion`, перейдите в неё и выполните `sniptale-motion new my-effect`. Эффект появится в `effects/my-effect/effect.sniptale-effect.json`. Проверьте его командой `sniptale-motion validate effects/my-effect/effect.sniptale-effect.json`.

Для целевого эффекта используйте `new my-effect --kind targetEffect`, для перехода — `--kind transition`. Относительные ассеты разрешаются от папки JSON; другой корень задаётся через `validate <файл> --asset-root <папка>`. Пути за пределами корня ассетов отклоняются. Статическая валидация не подтверждает рендер в браузере.

Команды `init` и `new` не заменяют существующие проекты и эффекты. При отказе записи команда завершается с ошибкой; частичная папка может остаться. Перед повтором проверьте её содержимое и выберите новую папку или идентификатор. Исходники пользователя автоматически не удаляются. Рабочая папка содержит `effects/`, `exports/` и `.tmp/`.

Опция `--json` возвращает один JSON-результат в stdout без прогресса. Коды завершения: 0 — успех, 1 — ошибка операции или невалидный эффект, 2 — неверные аргументы. По умолчанию справка на русском; `--locale en` включает английскую справку. `sniptale-motion docs` показывает эту инструкцию; `--version` показывает установленную версию. В этой сборке doctor сообщает Node и платформу; проверка наличия браузера ещё не реализована.

For English help, run `sniptale-motion --help --locale en`. Install the supplied archive with `npm install --global /absolute/path/sniptale-motion-0.1.0.tgz`. Run `sniptale-motion init my-motion`, enter that directory, then run `sniptale-motion new my-effect` and `sniptale-motion validate effects/my-effect/effect.sniptale-effect.json`. Existing projects and effects are never replaced. Use `--json` for machine results. This intermediate build provides static validation; Studio, browser proof, export and skill installation are still pending.
