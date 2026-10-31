export const messages = {
  common: {
    actions: {
      apply: { en: "Apply", ru: "Применить" },
      copy: { en: "Copy", ru: "Копировать" },
      play: { en: "Play", ru: "Пуск" },
      pause: { en: "Pause", ru: "Пауза" },
    },
    empty: {
      assets: {
        en: "No assets in this effect. Import one from Layers.",
        ru: "В эффекте нет ассетов. Импортируйте ассет из Layers.",
      },
      layers: { en: "No layers", ru: "Нет слоев" },
      presets: { en: "No presets", ru: "Нет пресетов" },
    },
    status: {
      loadingPack: { en: "Loading pack", ru: "Загрузка пакета" },
      noFrame: { en: "No frame", ru: "Нет кадра" },
    },
  },
  viewer: {
    studio: {
      reload: {
        updated: {
          ru: "Документ обновлён из проекта.",
          en: "Document updated from the project.",
        },
        pending: {
          ru: "В проекте есть новая версия. Текущие правки сохранены в редакторе.",
          en: "A new project version is available. Current editor changes were retained.",
        },
        unavailable: {
          ru: "Источник недоступен или не прошёл проверку. Последний корректный вариант сохранён в редакторе.",
          en: "The source is unavailable or invalid. The last valid document was retained in the editor.",
        },
        failed: {
          ru: "Обновление не применено. Текущий вариант оставлен в редакторе.",
          en: "The update was not applied. The current document was retained in the editor.",
        },
        apply: {
          ru: "Сохранить правки и обновить",
          en: "Save changes and load update",
        },
        retry: {
          ru: "Сохранить правки и повторить",
          en: "Save changes and retry",
        },
      },
      close: { ru: "Закрыть", en: "Close" },
      save: { ru: "Сохранить ревизию проекта", en: "Save project revision" },
      revisions: { ru: "Ревизии проекта", en: "Project revisions" },
      source: { ru: "Исходный документ", en: "Source document" },
      document: { ru: "Документ", en: "Document" },
      adopt: {
        ru: "Принять выбранный документ",
        en: "Adopt selected document",
      },
      adoptionHelp: {
        ru: "Выбранный документ будет использован при следующем открытии. Текущие правки останутся в редакторе; исходный файл не перезаписывается.",
        en: "Adoption selects the document for the next opening. Current changes stay in the editor; the source file is never replaced.",
      },
      saved: {
        ru: "Ревизия сохранена; исходный файл не перезаписан.",
        en: "Revision saved; the source file was not replaced.",
      },
      savedWithSourceChange: {
        ru: "Исходник изменился. Новая ревизия и внешний исходник сохранены отдельно.",
        en: "The source changed. The new revision and the external source were preserved separately.",
      },
      adopted: {
        ru: "Выбор сохранён для следующего открытия. Текущие правки оставлены в редакторе.",
        en: "Selection saved for the next opening. Current editor changes were retained.",
      },
      failed: {
        ru: "Операция проекта не выполнена. Перед повтором проверьте список сохранённых ревизий.",
        en: "Project operation failed. Check saved revisions before retrying.",
      },
    },
    domMotion: {
      loaded: { ru: "HTML-сцены загружены", en: "HTML motion scenes loaded" },
      liveOnly: {
        ru: "HTML-сцены воспроизводятся в реальном времени",
        en: "HTML scenes use live preview",
      },
      exportUnavailable: {
        ru: "Экспорт живой HTML-сцены в видео пока не поддерживается",
        en: "Live HTML scenes do not support video export yet",
      },
    },
    appTitle: { en: "Sniptale Motion SDK", ru: "Sniptale Motion SDK" },
    appKicker: { en: "Motion workspace", ru: "Редактор анимации" },
    appSubtitle: {
      en: "Agent-first declarative motion editor with a sandboxed safe runtime",
      ru: "Agent-first редактор анимации с безопасным декларативным runtime",
    },
    shell: {
      composition: { en: "Composition", ru: "Композиция" },
      fps: { en: "FPS", ru: "FPS" },
      frameSize: { en: "Frame", ru: "Кадр" },
      previewResolution: { en: "Preview", ru: "Превью" },
      language: { en: "Language", ru: "Язык" },
    },
    a11y: {
      canvasAids: {
        en: "Canvas aids",
        ru: "Помощники канваса",
      },
      canvasIsolationPath: {
        en: "Canvas isolation path",
        ru: "Путь изоляции на канвасе",
      },
      effectSandbox: { en: "Effect sandbox", ru: "Песочница эффекта" },
      fullscreenControls: {
        en: "Fullscreen playback controls",
        ru: "Управление полноэкранным воспроизведением",
      },
      inspectorSections: {
        en: "Inspector sections",
        ru: "Разделы инспектора",
      },
      motionPathOverlay: {
        en: "Motion path overlay",
        ru: "Контур траектории движения",
      },
      presetActions: { en: "Preset actions", ru: "Действия с пресетами" },
      previewGuidesOverlay: {
        en: "Preview positioning guides",
        ru: "Направляющие предпросмотра",
      },
      previewMode: {
        en: "Preview mode",
        ru: "Режим предпросмотра",
      },
      previewRasterResolution: {
        en: "Preview raster resolution. Composition geometry remains unchanged.",
        ru: "Разрешение растра превью. Геометрия композиции не изменяется.",
      },
      previewGuidesToggle: {
        en: "Toggle safe area and alignment guides",
        ru: "Показать безопасную область и направляющие",
      },
      previewSnapToggle: {
        en: "Snap canvas drag to guides",
        ru: "Привязывать объекты к направляющим",
      },
      previewZoom: { en: "Preview zoom", ru: "Масштаб предпросмотра" },
      resizePreviewTimeline: {
        en: "Resize preview and timeline",
        ru: "Изменить высоту предпросмотра и таймлайна",
      },
      resizeSidebar: {
        en: "Resize side panel",
        ru: "Изменить ширину боковой панели",
      },
      reviewSections: { en: "Review sections", ru: "Разделы проверки" },
      sidebarGroups: {
        en: "Workspace panels",
        ru: "Панели рабочей области",
      },
      timelineEditor: { en: "Timeline editor", ru: "Редактор таймлайна" },
      timelineHistoryControls: {
        en: "Edit history controls",
        ru: "Управление историей правок",
      },
      timelinePlaybackControls: {
        en: "Timeline playback controls",
        ru: "Управление воспроизведением таймлайна",
      },
      timelineViewControls: {
        en: "Timeline view controls",
        ru: "Настройки отображения таймлайна",
      },
    },
    canvas: {
      isolation: {
        editingInside: { en: "Inside", ru: "Внутри" },
        root: { en: "Canvas", ru: "Канвас" },
      },
      guides: {
        center: { en: "Center", ru: "Центр" },
        safeEnd: { en: "Safe area end", ru: "Конец безопасной области" },
        safeStart: {
          en: "Safe area start",
          ru: "Начало безопасной области",
        },
      },
      motionPath: {
        disabled: {
          en: "Enable both spatial keyframes and their tracks before editing this point.",
          ru: "Включите оба пространственных ключа и их треки, чтобы редактировать эту точку.",
        },
        inactive: {
          en: "This motion point is outside the active layer interval.",
          ru: "Эта точка движения находится вне активного интервала слоя.",
        },
        inTangent: {
          en: "Incoming motion tangent at {time}",
          ru: "Входящая направляющая траектории в {time}",
        },
        locked: {
          en: "Unlock the layer before editing its motion path.",
          ru: "Разблокируйте слой, чтобы редактировать его траекторию.",
        },
        point: {
          en: "Motion point at {time}",
          ru: "Точка движения в {time}",
        },
        outTangent: {
          en: "Outgoing motion tangent at {time}",
          ru: "Исходящая направляющая траектории в {time}",
        },
        temporalMismatch: {
          en: "Spatial interpolation requires matching temporal easing on the X and Y keyframes.",
          ru: "Для пространственной интерполяции временное сглаживание ключей X и Y должно совпадать.",
        },
        unsupported: {
          en: "This layer does not support spatial position editing.",
          ru: "Этот слой не поддерживает пространственное редактирование позиции.",
        },
      },
      hud: {
        cachedInteraction: {
          en: "Cached mode · frame updates after a pause or release",
          ru: "Кэш-режим · кадр обновится после паузы или отпускания",
        },
        outsideInterval: {
          en: "Selected · outside the current layer interval",
          ru: "Выбран · вне текущего интервала слоя",
        },
        positionSize: {
          en: "x {x} · y {y} · {width} × {height}",
          ru: "x {x} · y {y} · {width} × {height}",
        },
        rotation: {
          en: "Rotation {rotation}°",
          ru: "Поворот {rotation}°",
        },
        rendererManaged: {
          en: "Selection only · geometry is managed by the renderer",
          ru: "Только выделение · геометрией управляет рендерер",
        },
        layerSelection: {
          en: "{count} layers selected",
          ru: "Выбрано слоёв: {count}",
        },
        selectionBounds: {
          en: "left {x} · top {y} · {width} × {height}",
          ru: "слева {x} · сверху {y} · {width} × {height}",
        },
        selectionUnavailable: {
          en: "Selection contains hidden, inactive, or locked layers",
          ru: "В выделении есть скрытые, неактивные или заблокированные слои",
        },
        snap: { en: "Snap: {status}", ru: "Привязка: {status}" },
      },
      moveAnchorPoint: {
        en: "Move anchor point",
        ru: "Переместить опорную точку",
      },
      anchorPointerHint: {
        en: "Alt+drag or arrow keys",
        ru: "Alt+перетаскивание или клавиши со стрелками",
      },
      keyboardHint: { en: "Arrow keys", ru: "Клавиши со стрелками" },
      resize: {
        e: { en: "Resize from the right", ru: "Изменить размер справа" },
        n: { en: "Resize from the top", ru: "Изменить размер сверху" },
        ne: {
          en: "Resize from the top-right corner",
          ru: "Изменить размер от правого верхнего угла",
        },
        nw: {
          en: "Resize from the top-left corner",
          ru: "Изменить размер от левого верхнего угла",
        },
        s: { en: "Resize from the bottom", ru: "Изменить размер снизу" },
        se: {
          en: "Resize from the bottom-right corner",
          ru: "Изменить размер от правого нижнего угла",
        },
        sw: {
          en: "Resize from the bottom-left corner",
          ru: "Изменить размер от левого нижнего угла",
        },
        w: { en: "Resize from the left", ru: "Изменить размер слева" },
      },
      rotateLayer: { en: "Rotate layer", ru: "Повернуть слой" },
    },
    fields: {
      duration: { en: "Duration", ru: "Длительность" },
      easing: { en: "Easing", ru: "Интерполяция" },
      label: { en: "Label", ru: "Название" },
      offset: { en: "Offset", ru: "Смещение" },
      start: { en: "Start", ru: "Начало" },
      time: { en: "Time", ru: "Время" },
      value: { en: "Value", ru: "Значение" },
    },
    timeline: {
      title: { en: "Timeline", ru: "Таймлайн" },
      duration: { en: "Duration", ru: "Длительность" },
      durationShort: { en: "Dur.", ru: "Длит." },
      snap: { en: "Snap", ru: "Привязка" },
      snapFrame: { en: "Frame", ru: "Кадр" },
      snapFree: { en: "Free", ru: "Без привязки" },
      snapTenth: { en: "0.1s", ru: "0.1с" },
      zoom: { en: "Zoom", ru: "Масштаб" },
      linkedKeys: { en: "Linked keys", ru: "Связанные ключи" },
      blockOnly: { en: "Block only", ru: "Только блок" },
      blockOnlyTitle: {
        en: "Scene/clip/phase body drag moves only the block boundary",
        ru: "Перетаскивание тела сцены, клипа или фазы двигает только границу блока",
      },
      collapseAll: {
        en: "Collapse all timeline rows",
        ru: "Свернуть все строки таймлайна",
      },
      collapseRow: { en: "Collapse row", ru: "Свернуть строку" },
      expandAll: {
        en: "Expand all timeline rows",
        ru: "Развернуть все строки таймлайна",
      },
      expandRow: { en: "Expand row", ru: "Развернуть строку" },
      frameSelection: { en: "Frame selection", ru: "Показать выделение" },
      frameSelectionShortcut: {
        en: "Frame selection (F)",
        ru: "Показать выделение (F)",
      },
      searchLayers: { en: "Search layers", ru: "Поиск слоёв" },
      searchLayersShortcut: {
        en: "Search layers (Ctrl+F)",
        ru: "Поиск слоёв (Ctrl+F)",
      },
      searchLayersPlaceholder: {
        en: "Search by name, ID, type, or group",
        ru: "Название, ID, тип или группа",
      },
      searchLayersHint: {
        en: "Type a layer name, ID, type, or group path.",
        ru: "Введите название, ID, тип слоя или путь группы.",
      },
      searchLayersNoResults: {
        en: "No matching layers.",
        ru: "Подходящие слои не найдены.",
      },
      searchLayerLocked: { en: "Locked", ru: "Заблокирован" },
      searchLayerHidden: { en: "Hidden", ru: "Скрыт" },
      layerClip: { en: "Layer interval", ru: "Интервал слоя" },
      layerIntervalRole: { en: "Clip timing", ru: "Время клипа" },
      layer: { en: "Layer", ru: "Слой" },
      scene: { en: "Scene", ru: "Сцена" },
      scopes: {
        global: { en: "Global", ru: "Глобальный" },
      },
      layerTypes: {
        audio: { en: "Audio", ru: "Аудио" },
        customDraw: { en: "Runtime layer", ru: "Слой движка" },
        ellipse: { en: "Ellipse", ru: "Эллипс" },
        imageAsset: { en: "Image", ru: "Изображение" },
        line: { en: "Line", ru: "Линия" },
        path: { en: "Path", ru: "Контур" },
        rect: { en: "Rectangle", ru: "Прямоугольник" },
        group: { en: "Group", ru: "Группа" },
        shape: { en: "Shape", ru: "Фигура" },
        svgAsset: { en: "SVG", ru: "SVG" },
        text: { en: "Text", ru: "Текст" },
      },
      phase: { en: "Phase", ru: "Фаза" },
      propertyTrack: { en: "Property track", ru: "Трек свойства" },
      clipRawInterval: { en: "Raw", ru: "Исходный" },
      clipIntervalComparison: {
        en: "Raw {raw} · Effective {effective}",
        ru: "Исходный {raw} · После ограничения {effective}",
      },
      linkedKeysTitle: {
        en: "Scene/clip/phase body drag also moves owned timing and keyframes",
        ru: "Перетаскивание тела сцены, клипа или фазы двигает связанные интервалы и ключи",
      },
      noOwnedTracks: { en: "No owned tracks", ru: "Нет связанных треков" },
      noOwnedTracksWithMeta: {
        en: "No owned tracks · {meta}",
        ru: "Нет связанных треков · {meta}",
      },
      propertyGroup: { en: "Properties", ru: "Свойства" },
      sceneTracks: { en: "Scene tracks", ru: "Треки сцены" },
      sceneSummaryCompact: {
        en: "{clips} clips · {phases} phases · {tracks} tracks",
        ru: "Клипов: {clips} · фаз: {phases} · треков: {tracks}",
      },
      sceneSummaryFull: {
        en: "{clips} clips · {phases} phases · {tracks} tracks · {keys} keyframes",
        ru: "Клипов: {clips} · фаз: {phases} · треков: {tracks} · ключей: {keys}",
      },
      curveSegmentRange: {
        en: "Curve segment {start} → {end}",
        ru: "Сегмент кривой {start} → {end}",
      },
      trackCountOne: { en: "{count} track", ru: "{count} трек" },
      trackCountFew: { en: "{count} tracks", ru: "{count} трека" },
      trackCountMany: { en: "{count} tracks", ru: "{count} треков" },
      trackCountOther: { en: "{count} tracks", ru: "{count} трека" },
      toggleLayer: { en: "Toggle layer", ru: "Включить/выключить слой" },
      toggleGroupVisibility: {
        en: "Toggle group visibility",
        ru: "Переключить видимость группы",
      },
      lockGroup: { en: "Lock group", ru: "Заблокировать группу" },
      unlockGroup: { en: "Unlock group", ru: "Разблокировать группу" },
      groupRange: {
        en: "Child range · {range}",
        ru: "Диапазон дочерних слоёв · {range}",
      },
      groupItemCount: {
        en: "{count} items",
        ru: "Элементов: {count}",
      },
      reorderLayer: {
        en: "Reorder or move layer into a group",
        ru: "Переставить слой или переместить его в группу",
      },
      reparentLocked: {
        en: "Unlock every selected layer before moving it in the hierarchy.",
        ru: "Перед перемещением в иерархии разблокируйте все выбранные слои.",
      },
      keyframePlacementUnavailable: {
        en: "There is no collision-free space for these keyframes.",
        ru: "Для этих ключевых кадров нет свободного интервала без пересечений.",
      },
      keyframeTimeCollision: {
        en: "The operation would overlap keyframes on the same track.",
        ru: "Операция приведёт к наложению ключевых кадров на одном треке.",
      },
      keyframeTimeOutOfRange: {
        en: "The operation would move keyframes outside the composition.",
        ru: "Операция переместит ключевые кадры за пределы композиции.",
      },
      keyframeScaleInvalid: {
        en: "Keyframe scale must be greater than zero.",
        ru: "Масштаб интервала ключевых кадров должен быть больше нуля.",
      },
      keyframeSelectionInsufficient: {
        en: "Select more keyframes for this operation.",
        ru: "Для этой операции выберите больше ключевых кадров.",
      },
      togglePhase: { en: "Toggle phase", ru: "Включить/выключить фазу" },
      toggleScene: { en: "Toggle scene", ru: "Включить/выключить сцену" },
      toggleTrack: { en: "Toggle track", ru: "Включить/выключить трек" },
      emptyPropertyLaneTitle: {
        en: "Click to seek. Drag an empty property row to shift its visible keyframes.",
        ru: "Щелчок перемещает курсор. Перетаскивание пустого трека сдвигает его видимые ключи.",
      },
      deleteIntervalHint: {
        en: "The layer interval is selected. Select the layer name to delete the layer.",
        ru: "Выбран интервал слоя. Чтобы удалить слой, выберите его название.",
      },
      orderHint: {
        en: "Higher rows render above lower rows. Drag to reorder.",
        ru: "Верхние слои рисуются над нижними. Перетащите строку для изменения порядка.",
      },
      addKeyAtPlayhead: {
        en: "Add key at playhead",
        ru: "Добавить ключ на курсоре",
      },
      addKeyAtPlayheadTitle: {
        en: "Create or update a keyframe on this track at the playhead. Shortcut: K",
        ru: "Создать или обновить ключевой кадр этого трека на позиции курсора. Клавиша: K",
      },
      addKeyframeAtCurrentTime: {
        en: "Add keyframe at current time",
        ru: "Добавить ключевой кадр в текущей позиции",
      },
      removeKeyframeAtCurrentTime: {
        en: "Remove keyframe at current time",
        ru: "Удалить ключевой кадр в текущей позиции",
      },
      keyframeIcon: { en: "◆", ru: "◆" },
      zoomIn: { en: "Zoom in", ru: "Приблизить" },
      zoomOut: { en: "Zoom out", ru: "Отдалить" },
    },
    graphEditor: {
      loadFailed: {
        ru: "Не удалось загрузить редактор кривых. Повторите действие.",
        en: "Could not load the graph editor. Try the action again.",
      },
      title: { en: "Graph Editor", ru: "Редактор кривых" },
      toggle: {
        en: "Toggle Graph Editor",
        ru: "Показать или скрыть редактор кривых",
      },
      canvasLabel: {
        en: "Editable value curves over time",
        ru: "Редактируемые кривые значений во времени",
      },
      selectionStatus: {
        en: "{keys} keys · {tracks} track",
        ru: "Ключей: {keys} · трек: {tracks}",
      },
      multiTrackStatus: {
        en: "{keys} keys · {tracks} tracks · time drag only",
        ru: "Ключей: {keys} · треков: {tracks} · перетаскивание только по времени",
      },
      fitSelection: { en: "Fit selection", ru: "Показать выделение" },
      fitAll: { en: "Fit curves", ru: "Показать все кривые" },
      zoomOut: { en: "Zoom out", ru: "Отдалить" },
      zoomIn: { en: "Zoom in", ru: "Приблизить" },
      linkedHandles: {
        en: "Linked handles",
        ru: "Связанные направляющие",
      },
      splitHandles: {
        en: "Split handles",
        ru: "Раздельные направляющие",
      },
      easingPreset: { en: "Easing", ru: "Сглаживание" },
      close: { en: "Close Graph Editor", ru: "Закрыть редактор кривых" },
      scaleRangeStart: {
        en: "Scale selection from start",
        ru: "Масштабировать выделение от начала",
      },
      scaleRangeEnd: {
        en: "Scale selection from end",
        ru: "Масштабировать выделение от конца",
      },
    },
    inspector: {
      layer: { en: "Layer", ru: "Слой" },
      audio: { en: "Audio", ru: "Аудио" },
      audioCanvasNote: {
        en: "Audio is edited on the timeline and has no canvas geometry.",
        ru: "Аудио редактируется на таймлайне и не имеет геометрии на канвасе.",
      },
      runtimeLayerCanvasNote: {
        en: "The renderer owns this layer's geometry, so the canvas only selects it. Edit the supported properties below.",
        ru: "Геометрию слоя задаёт рендерер, поэтому на канвасе доступно только выделение. Поддерживаемые параметры можно изменить ниже.",
      },
      contentAppearance: {
        en: "Content & appearance",
        ru: "Содержимое и вид",
      },
      svgPartAnimation: {
        en: "SVG part animation",
        ru: "Анимация частей SVG",
      },
      advanced: { en: "Advanced", ru: "Дополнительно" },
      selection: {
        title: { en: "Layer selection", ru: "Выбор слоёв" },
        count: { en: "{count} layers", ru: "Слоёв: {count}" },
        items: { en: "Items", ru: "Элементы" },
        types: { en: "Types", ru: "Типы" },
        locked: { en: "Locked", ru: "Заблокировано" },
        hidden: { en: "Hidden", ru: "Скрыто" },
        inactive: { en: "Inactive", ru: "Неактивно" },
        nonSpatial: { en: "Non-spatial", ru: "Без геометрии" },
        structure: { en: "Structure", ru: "Структура" },
        frame: { en: "Selection frame", ru: "Общая рамка" },
        left: { en: "Left", ru: "Слева" },
        top: { en: "Top", ru: "Сверху" },
        width: { en: "Width", ru: "Ширина" },
        height: { en: "Height", ru: "Высота" },
        layout: { en: "Align & distribute", ru: "Выравнивание" },
        alignLeft: { en: "Left", ru: "Влево" },
        alignHorizontalCenter: { en: "Center", ru: "По центру" },
        alignRight: { en: "Right", ru: "Вправо" },
        alignTop: { en: "Top", ru: "Вверх" },
        alignVerticalCenter: { en: "Middle", ru: "По середине" },
        alignBottom: { en: "Bottom", ru: "Вниз" },
        distributeHorizontal: {
          en: "Equal horizontal gaps",
          ru: "Равные интервалы по горизонтали",
        },
        distributeVertical: {
          en: "Equal vertical gaps",
          ru: "Равные интервалы по вертикали",
        },
        common: { en: "Common properties", ru: "Общие свойства" },
        operationUnavailable: {
          en: "This operation requires every selected layer to be active, unlocked, and spatial.",
          ru: "Для операции все выбранные слои должны быть активны, разблокированы и иметь геометрию.",
        },
        resizeUnavailable: {
          en: "Proportional resize is unavailable because one or more selected layers do not support scale.",
          ru: "Пропорциональный ресайз недоступен: один или несколько выбранных слоёв не поддерживают масштабирование.",
        },
      },
      keyframeSelection: {
        title: {
          en: "Keyframe selection",
          ru: "Выбранные ключевые кадры",
        },
        count: {
          en: "{count} keyframes",
          ru: "Ключевых кадров: {count}",
        },
        items: { en: "Keyframes", ru: "Ключевые кадры" },
        tracks: { en: "Tracks", ru: "Треки" },
        trackCount: { en: "{count} tracks", ru: "Треков: {count}" },
        numeric: { en: "Numeric values", ru: "Числовые значения" },
        range: { en: "Selection range", ru: "Диапазон выбора" },
        arrange: { en: "Arrange in time", ru: "Расположение во времени" },
        alignStart: { en: "Align start", ru: "В начало" },
        alignPlayhead: {
          en: "Align to playhead",
          ru: "К позиции курсора",
        },
        alignEnd: { en: "Align end", ru: "В конец" },
        distribute: { en: "Distribute", ru: "Распределить" },
        quantize: { en: "Quantize to frames", ru: "Привязать к кадрам" },
        common: { en: "Common properties", ru: "Общие свойства" },
        valueUnavailable: {
          en: "Value editing requires every selected keyframe to contain a numeric value.",
          ru: "Для изменения значения все выбранные ключевые кадры должны содержать числа.",
        },
        easingUnavailable: {
          en: "Easing requires an outgoing segment for every selected keyframe.",
          ru: "Для изменения easing у каждого выбранного ключевого кадра должен быть исходящий сегмент.",
        },
        mixed: { en: "—", ru: "—" },
        mixedCount: { en: "{count} values", ru: "Значений: {count}" },
      },
      motionPath: {
        title: {
          en: "Spatial motion points",
          ru: "Точки траектории",
        },
        points: { en: "Points", ru: "Точки" },
        position: { en: "Position", ru: "Позиция" },
        spatialInterpolation: {
          en: "Spatial interpolation",
          ru: "Пространственная интерполяция",
        },
        pointType: { en: "Point type", ru: "Тип точки" },
        bulkHint: {
          en: "The point type applies to all {count} selected motion points.",
          ru: "Тип будет применён ко всем выбранным точкам: {count}.",
        },
        coordinateTracks: {
          en: "Coordinate tracks",
          ru: "Треки координат",
        },
        types: {
          linear: { en: "Linear", ru: "Линейная" },
          smooth: { en: "Smooth", ru: "Сглаженная" },
          corner: { en: "Corner", ru: "Угловая" },
        },
      },
      transform: { en: "Transform", ru: "Трансформация" },
      clipTiming: { en: "Clip timing", ru: "Время слоя" },
      keyframeCurve: { en: "Keyframe curve", ru: "Кривая ключевого кадра" },
      end: { en: "End", ru: "Конец" },
      nextKey: { en: "Next key", ru: "Следующий ключ" },
      noOutgoingSegment: {
        en: "No outgoing segment",
        ru: "Нет следующего сегмента",
      },
      ownership: { en: "Links", ru: "Связи" },
      phaseTiming: { en: "Phase timing", ru: "Время фазы" },
      previousKey: { en: "Previous key", ru: "Предыдущий ключ" },
      sceneTiming: { en: "Scene timing", ru: "Время сцены" },
      segment: { en: "Segment", ru: "Сегмент" },
      segmentRange: {
        en: "Curve affects {start} → {end}",
        ru: "Кривая действует от {start} до {end}",
      },
      timingOwnership: { en: "Timing links", ru: "Связи по времени" },
      trackActions: { en: "Track actions", ru: "Действия с треком" },
      overview: { en: "Overview", ru: "Обзор" },
      timing: { en: "Timing", ru: "Время" },
      properties: { en: "Properties", ru: "Свойства" },
      links: { en: "Links", ru: "Связи" },
      context: {
        asset: { en: "Asset", ru: "Ассет" },
        clip: { en: "Layer interval", ru: "Интервал слоя" },
        effect: { en: "Composition", ru: "Композиция" },
        keyframe: { en: "Keyframe", ru: "Ключевой кадр" },
        layer: { en: "Layer", ru: "Слой" },
        phase: { en: "Phase", ru: "Фаза" },
        scene: { en: "Scene", ru: "Сцена" },
        track: { en: "Property track", ru: "Трек свойства" },
      },
      curvePresets: {
        back: { en: "Overshoot", ru: "С перебегом" },
        bezier: { en: "Custom", ru: "Своя" },
        custom: { en: "Custom", ru: "Своя" },
        hold: { en: "Hold", ru: "Удержание" },
        in: { en: "Ease in", ru: "Плавный вход" },
        inOut: { en: "Ease in-out", ru: "Вход и выход" },
        linear: { en: "Linear", ru: "Линейно" },
        out: { en: "Ease out", ru: "Плавный выход" },
      },
      fields: {
        bundleType: { en: "Content type", ru: "Тип материала" },
        anchorX: { en: "Anchor X", ru: "Опорная точка X" },
        anchorY: { en: "Anchor Y", ru: "Опорная точка Y" },
        blur: { en: "Blur", ru: "Размытие" },
        duration: { en: "Duration", ru: "Длительность" },
        easing: { en: "Easing", ru: "Интерполяция" },
        keys: { en: "Keyframes", ru: "Ключевые кадры" },
        layer: { en: "Layer", ru: "Слой" },
        layers: { en: "Layers", ru: "Слои" },
        loop: { en: "Loop", ru: "Повтор" },
        name: { en: "Name", ru: "Название" },
        offset: { en: "Offset", ru: "Смещение" },
        opacity: { en: "Opacity", ru: "Непрозрачность" },
        scrollbarOpacity: {
          en: "Scrollbar opacity",
          ru: "Непрозрачность полос прокрутки",
        },
        path: { en: "Path", ru: "Путь" },
        phase: { en: "Phase", ru: "Фаза" },
        property: { en: "Property", ru: "Свойство" },
        rotation: { en: "Rotation", ru: "Поворот" },
        scaleX: { en: "Scale X", ru: "Масштаб X" },
        scaleY: { en: "Scale Y", ru: "Масштаб Y" },
        scene: { en: "Scene", ru: "Сцена" },
        scenes: { en: "Scenes", ru: "Сцены" },
        size: { en: "Size", ru: "Размер" },
        start: { en: "Start", ru: "Начало" },
        state: { en: "State", ru: "Состояние" },
        template: { en: "Template", ru: "Шаблон" },
        time: { en: "Time", ru: "Время" },
        type: { en: "Type", ru: "Тип" },
        track: { en: "Track", ru: "Трек" },
        tracks: { en: "Tracks", ru: "Треки" },
        usedBy: { en: "Used by", ru: "Использование" },
        value: { en: "Value", ru: "Значение" },
      },
      values: {
        autoNone: { en: "Auto / none", ru: "Авто / нет" },
        autoTime: { en: "Auto / time window", ru: "Авто / по времени" },
        inherit: { en: "Inherit {value}", ru: "Наследовать {value}" },
        hidden: { en: "Hidden", ru: "Скрыт" },
        layerCount: { en: "{count} layers", ru: "Слоев: {count}" },
        missing: { en: "Missing", ru: "Отсутствует" },
        locked: { en: "Locked", ru: "Заблокирован" },
        none: { en: "None", ru: "Нет" },
        off: { en: "Off", ru: "Выкл." },
        on: { en: "On", ru: "Вкл." },
        outOfRange: { en: "Out of range", ru: "Вне диапазона" },
        timingWarnings: {
          en: "Has timing warnings",
          ru: "Есть предупреждения по времени",
        },
        unknown: { en: "Unknown", ru: "Неизвестно" },
        valid: { en: "Valid", ru: "Корректно" },
        visible: { en: "Visible", ru: "Виден" },
      },
      svgPartBrowser: { en: "SVG Part Browser", ru: "Части SVG" },
      usage: { en: "Usage", ru: "Использование" },
      ownershipDetails: {
        bodyMoves: { en: "Body moves", ru: "Тело перемещает" },
        clipMoveCount: {
          en: "{keys} layer keys · {phases} phases",
          ru: "Ключей слоя: {keys} · фаз: {phases}",
        },
        clipNote: {
          en: "Dragging the body moves the clip, compatible layer keyframes, and their phases. Edge handles only change in/out.",
          ru: "Перетаскивание тела двигает клип, совместимые ключи слоя и их фазы. Краевые маркеры меняют только вход и выход.",
        },
        clipTrim: {
          en: "Clip start/end handles",
          ru: "Маркеры начала и конца клипа",
        },
        defaultPhase: { en: "Default phase", ru: "Фаза по умолчанию" },
        defaultScene: { en: "Default scene", ru: "Сцена по умолчанию" },
        keyCount: { en: "{keys} keys", ru: "Ключей: {keys}" },
        keyframeNote: {
          en: "Dragging a keyframe moves this key or the current multi-selection. Parent blocks show what can move it as a group.",
          ru: "Перетаскивание двигает этот ключ или текущее множественное выделение. Родительские блоки показывают, что можно двигать группой.",
        },
        layerClip: { en: "Layer clip", ru: "Клип слоя" },
        layerKey: { en: "Layer key", ru: "Ключ слоя" },
        phaseMoveCount: {
          en: "{keys} phase keys",
          ru: "Ключей фазы: {keys}",
        },
        phaseNote: {
          en: "Dragging the body moves the phase and its keyframes. Edge handles only resize the phase.",
          ru: "Перетаскивание тела двигает фазу и её ключи. Краевые маркеры меняют только размер фазы.",
        },
        phaseTrim: {
          en: "Phase start/end handles",
          ru: "Маркеры начала и конца фазы",
        },
        sceneMoveCount: {
          en: "{clips} clips · {phases} phases · {keys} keys",
          ru: "Клипов: {clips} · фаз: {phases} · ключей: {keys}",
        },
        sceneNote: {
          en: "Dragging the body moves linked clips, phases, and keyframes. Edge handles only change scene boundaries.",
          ru: "Перетаскивание тела двигает связанные клипы, фазы и ключи. Краевые маркеры меняют только границы сцены.",
        },
        sceneTrim: {
          en: "Scene edge handles",
          ru: "Краевые маркеры сцены",
        },
        selectionKey: { en: "Selection key", ru: "Ключ выделения" },
        separate: { en: "Separate", ru: "Отдельно" },
        timeWindow: { en: "Time window", ru: "По времени" },
        trackMoves: { en: "Track moves", ru: "Трек перемещает" },
        trackNote: {
          en: "Dragging a track moves every keyframe on this property. Individual keys can override phase or scene links.",
          ru: "Перетаскивание трека двигает все ключи свойства. Отдельные ключи могут переопределять связи с фазой или сценой.",
        },
      },
      layerFields: {
        blendMode: { en: "Blend", ru: "Наложение" },
        closed: { en: "Closed", ru: "Замкнутый контур" },
        color: { en: "Color", ru: "Цвет" },
        fill: { en: "Fill", ru: "Заливка" },
        fontFamily: { en: "Font family", ru: "Шрифт" },
        fontSize: { en: "Font size", ru: "Размер шрифта" },
        height: { en: "Height", ru: "Высота" },
        partBlur: { en: "Part blur", ru: "Размытие частей" },
        partOrder: { en: "Part order", ru: "Порядок частей" },
        partReveal: { en: "Part reveal", ru: "Появление частей" },
        partStagger: { en: "Part stagger", ru: "Задержка частей" },
        partSpread: { en: "Part spread", ru: "Разброс частей" },
        pathClosed: { en: "Closed", ru: "Замкнутый контур" },
        radius: { en: "Radius", ru: "Радиус" },
        stroke: { en: "Stroke", ru: "Обводка" },
        strokeWidth: { en: "Stroke", ru: "Толщина обводки" },
        svgPartIds: { en: "Part ids", ru: "ID частей" },
        svgPartMode: { en: "SVG parts", ru: "Части SVG" },
        svgPartOrder: { en: "Part order", ru: "Порядок частей" },
        svgPartProgress: { en: "Part reveal", ru: "Появление частей" },
        svgPartStagger: { en: "Part stagger", ru: "Задержка частей" },
        svgPartSpread: { en: "Part spread", ru: "Разброс частей" },
        svgPartBlur: { en: "Part blur", ru: "Размытие частей" },
        text: { en: "Text", ru: "Текст" },
        trimEnd: { en: "Trim end", ru: "Конец обрезки" },
        trimStart: { en: "Trim start", ru: "Начало обрезки" },
        volume: { en: "Volume", ru: "Громкость" },
        width: { en: "Width", ru: "Ширина" },
      },
      layerOptions: {
        blendMode: {
          "source-over": { en: "Normal", ru: "Обычный" },
          lighter: { en: "Add", ru: "Сложение" },
          screen: { en: "Screen", ru: "Экран" },
          multiply: { en: "Multiply", ru: "Умножение" },
          overlay: { en: "Overlay", ru: "Перекрытие" },
        },
        partOrder: {
          document: { en: "Document order", ru: "По порядку в SVG" },
          reverse: { en: "Reverse order", ru: "В обратном порядке" },
          center: { en: "Center outward", ru: "От центра" },
          edges: { en: "Edges inward", ru: "От краёв" },
          random: { en: "Random", ru: "Случайно" },
        },
        svgPartMode: {
          none: { en: "None", ru: "Без анимации" },
          reveal: { en: "Reveal", ru: "Появление" },
          scatter: { en: "Scatter", ru: "Разлёт" },
        },
      },
    },
    layers: {
      copyName: { en: "{name} Copy", ru: "{name} — копия" },
      deletedCount: {
        en: "Deleted {count} items.",
        ru: "Удалено элементов: {count}.",
      },
      duplicatedCount: {
        en: "Duplicated {count} items.",
        ru: "Дублировано элементов: {count}.",
      },
      group: { en: "Group", ru: "Сгруппировать" },
      ungroup: { en: "Ungroup", ru: "Разгруппировать" },
      groupName: { en: "Group {number}", ru: "Группа {number}" },
      hide: { en: "Hide layer", ru: "Скрыть слой" },
      show: { en: "Show layer", ru: "Показать слой" },
      lock: { en: "Lock layer", ru: "Заблокировать слой" },
      unlock: { en: "Unlock layer", ru: "Разблокировать слой" },
      groupingErrors: {
        "different-parents": {
          en: "Selected layers must have the same parent.",
          ru: "У выбранных слоёв должен быть один родитель.",
        },
        "invalid-hierarchy": {
          en: "Repair the layer hierarchy before grouping.",
          ru: "Перед группировкой исправьте иерархию слоёв.",
        },
        "non-contiguous": {
          en: "Selected layers must be adjacent in stacking order.",
          ru: "Выбранные слои должны находиться рядом в порядке наложения.",
        },
        "selection-too-small": {
          en: "Select at least two layers.",
          ru: "Выберите как минимум два слоя.",
        },
        "too-deep": {
          en: "The resulting group would be nested too deeply.",
          ru: "Получившаяся группа будет вложена слишком глубоко.",
        },
      },
      selectBeforeDelete: {
        en: "Select a layer before deleting.",
        ru: "Перед удалением выберите слой.",
      },
      selectBeforeDuplicate: {
        en: "Select a layer before duplicating.",
        ru: "Перед дублированием выберите слой.",
      },
      deleteUnsupported: {
        en: "{layer} cannot be deleted from this renderer.",
        ru: "Слой «{layer}» нельзя удалить из этого рендерера.",
      },
      duplicateUnsupported: {
        en: "{layer} cannot be duplicated because its renderer owns a fixed layer structure.",
        ru: "Слой «{layer}» нельзя дублировать: его структура зафиксирована рендерером.",
      },
    },
    editor: {
      cancel: { en: "Cancel", ru: "Отмена" },
      redo: { en: "Redo", ru: "Повторить" },
      resetChanges: { en: "Reset to source", ru: "Сбросить к исходнику" },
      resetConfirm: { en: "Reset changes", ru: "Сбросить правки" },
      resetDescription: {
        en: "The composition will return to its loaded source. Reset is stored as one undoable action.",
        ru: "Композиция вернётся к загруженному исходнику. Сброс сохранится как одно действие, которое можно отменить.",
      },
      resetTitle: {
        en: "Reset temporary changes?",
        ru: "Сбросить временные правки?",
      },
      saveDraft: { en: "Save local draft", ru: "Сохранить черновик" },
      status: {
        clean: { en: "No temporary changes", ru: "Нет временных правок" },
        conflict: {
          en: "Draft changed in another tab — reload the page",
          ru: "Черновик изменён в другой вкладке — обновите страницу",
        },
        error: {
          en: "Draft could not be saved",
          ru: "Не удалось сохранить черновик",
        },
        pending: {
          en: "Unsaved temporary changes",
          ru: "Есть несохранённые правки",
        },
        restored: { en: "Draft restored", ru: "Черновик восстановлен" },
        saved: { en: "Draft saved", ru: "Черновик сохранён" },
        saving: { en: "Saving draft…", ru: "Сохранение черновика…" },
      },
      undo: { en: "Undo", ru: "Отменить" },
    },
    menu: {
      fileActions: { en: "File actions", ru: "Файлы" },
      editing: { en: "Editing", ru: "Редактирование" },
      projectSource: { en: "Project source", ru: "Исходник проекта" },
      bindJson: { en: "Open JSON source", ru: "Открыть JSON" },
      saveJson: { en: "Save JSON source", ru: "Сохранить JSON" },
      exportJson: { en: "Export JSON copy", ru: "Экспортировать копию JSON" },
      effectFile: { en: "Effect file", ru: "Файл эффекта" },
      importEffect: { en: "Import .effect", ru: "Импортировать .effect" },
      exportEffect: { en: "Export .effect", ru: "Экспортировать .effect" },
      publish: { en: "Publish", ru: "Публикация" },
      exportMp4: { en: "Export MP4", ru: "Экспорт MP4" },
    },
    mp4Export: {
      audioCodec: { en: "Audio codec", ru: "Аудиокодек" },
      audioDecodeFailed: {
        en: "Timeline audio could not be decoded.",
        ru: "Не удалось декодировать аудио с таймлайна.",
      },
      audioReady: {
        en: "Timeline audio will be included.",
        ru: "Аудио с таймлайна будет добавлено.",
      },
      noTimelineAudio: {
        en: "No timeline audio found. Exporting video-only MP4.",
        ru: "Аудио на таймлайне не найдено. Экспорт MP4 будет без аудио.",
      },
      codecAac: { en: "AAC", ru: "AAC" },
      codecAv1: { en: "AV1", ru: "AV1" },
      codecAvc: { en: "H.264 / AVC", ru: "H.264 / AVC" },
      codecHevc: { en: "H.265 / HEVC", ru: "H.265 / HEVC" },
      codecOpus: { en: "Opus", ru: "Opus" },
      codecVp9: { en: "VP9", ru: "VP9" },
      cancel: { en: "Cancel", ru: "Отмена" },
      canceled: { en: "MP4 export canceled.", ru: "Экспорт MP4 отменен." },
      close: { en: "Close MP4 export", ru: "Закрыть экспорт MP4" },
      customSize: { en: "Custom", ru: "Своя" },
      exported: { en: "Exported MP4", ru: "MP4 экспортирован" },
      exporting: {
        en: "Exporting frame {frame} of {total}",
        ru: "Экспорт кадра {frame} из {total}",
      },
      failed: { en: "MP4 export failed", ru: "Ошибка экспорта MP4" },
      fps: { en: "FPS", ru: "FPS" },
      height: { en: "Height", ru: "Высота" },
      noAudioCodec: {
        en: "No supported audio codec for this browser.",
        ru: "В этом браузере нет поддерживаемого аудиокодека.",
      },
      noVideoCodec: {
        en: "No supported video codec for this browser.",
        ru: "В этом браузере нет поддерживаемого видеокодека.",
      },
      preparing: { en: "Preparing MP4 export", ru: "Подготовка MP4" },
      size: { en: "Size", ru: "Размер" },
      start: { en: "Export", ru: "Экспорт" },
      title: { en: "Export MP4", ru: "Экспорт MP4" },
      videoCodec: { en: "Video codec", ru: "Видеокодек" },
      width: { en: "Width", ru: "Ширина" },
    },
    preview: {
      cachePreparationPaused: {
        en: "Preview preparation paused · {progress}% · {visited}/{total} frames",
        ru: "Подготовка превью приостановлена · {progress}% · {visited}/{total} кадров",
      },
      cacheUpdatePaused: {
        en: "Preview update paused · {restored}/{segments} segments reused · {progress}% · {visited}/{total} frames",
        ru: "Обновление превью приостановлено · повторно используется {restored}/{segments} сегментов · {progress}% · {visited}/{total} кадров",
      },
      cacheDisabled: {
        en: "Live mode enabled",
        ru: "Включён Live-режим",
      },
      cacheEnabled: {
        en: "Cache + preview mode enabled",
        ru: "Включён режим «Кэш + превью»",
      },
      cacheBuildingButton: {
        en: "Preparing preview {progress}%. Playback starts automatically when ready; choose Live to start now.",
        ru: "Подготовка превью {progress}%. После завершения воспроизведение запустится автоматически; Live — начать сейчас.",
      },
      cacheUpdatingButton: {
        en: "Updating preview {progress}%; {restored}/{segments} saved segments reused. Playback starts automatically when ready; choose Live to start now.",
        ru: "Обновление превью {progress}%; повторно используется {restored}/{segments} сохранённых сегментов. После завершения воспроизведение запустится автоматически; Live — начать сейчас.",
      },
      cachePersistentReady: {
        en: "Cache + preview mode: the saved full-quality preview is ready for reuse.",
        ru: "Режим «Кэш + превью»: сохранённое превью в полном качестве готово к повторному использованию.",
      },
      cacheRestoringButton: {
        en: "Restoring a saved full-quality preview.",
        ru: "Восстановление сохранённого превью в полном качестве.",
      },
      cacheCapacityLimited: {
        en: "Preview is larger than the lossless cache limit · missing frames render live",
        ru: "Превью больше лимита lossless-кэша · недостающие кадры рендерятся в Live",
      },
      cachedMode: { en: "Cache + preview", ru: "Кэш + превью" },
      cachedModeShort: { en: "Cache", ru: "Кэш" },
      cachedModeDescription: {
        en: "Cache + preview mode: prepare full-quality playback once and defer heavy canvas renders until the interaction pauses.",
        ru: "Режим «Кэш + превью»: один раз подготовить воспроизведение в полном качестве и обновлять тяжёлый кадр после паузы в редактировании.",
      },
      cacheRemainingCalculating: {
        en: "estimating time",
        ru: "расчёт времени",
      },
      cacheRemainingMinutes: {
        en: "about {minutes} min",
        ru: "около {minutes} мин",
      },
      cacheRemainingSeconds: {
        en: "about {seconds}s",
        ru: "около {seconds} с",
      },
      cacheReady: {
        en: "Preview ready",
        ru: "Превью готово",
      },
      fit: { en: "Fit", ru: "Вписать" },
      guides: { en: "Guides", ru: "Направляющие" },
      liveMode: { en: "Live", ru: "Live" },
      liveModeDescription: {
        en: "Live mode: start immediately and render every playback and canvas interaction frame.",
        ru: "Live-режим: сразу запускать воспроизведение и рендерить каждый кадр воспроизведения и редактирования.",
      },
      media: {
        choose: { en: "Choose", ru: "Выбрать" },
        clear: { en: "Clear", ru: "Убрать" },
        clearAll: { en: "Clear all", ru: "Убрать все" },
        fallback: { en: "Sample scene", ru: "Тестовая сцена" },
        from: { en: "From frame", ru: "Исходный кадр" },
        invalid: {
          en: "Choose an image or video file.",
          ru: "Выберите изображение или видео.",
        },
        loadFailed: {
          en: "The test media could not be opened.",
          ru: "Не удалось открыть тестовый медиафайл.",
        },
        loading: { en: "Opening…", ru: "Открытие…" },
        menu: { en: "Test media", ru: "Тестовые медиа" },
        panelLabel: {
          en: "Temporary test media",
          ru: "Временные тестовые медиа",
        },
        sessionNote: {
          en: "Used only in this browser session. Never saved, exported, or added to history.",
          ru: "Используются только в этой сессии браузера. Не сохраняются, не экспортируются и не попадают в историю.",
        },
        source: { en: "Source", ru: "Объект" },
        to: { en: "To frame", ru: "Конечный кадр" },
        tooLarge: {
          en: "The test media exceeds the 512 MB session limit.",
          ru: "Тестовый медиафайл превышает лимит сессии 512 МБ.",
        },
      },
      snap: { en: "Snap", ru: "Привязка" },
      exitFullscreen: {
        en: "Exit fullscreen preview",
        ru: "Выйти из полноэкранного просмотра",
      },
      openFullscreen: {
        en: "Open fullscreen preview",
        ru: "Открыть предпросмотр на весь экран",
      },
      preparingCache: {
        en: "Preparing before playback · {progress}% · {visited}/{total} frames · {remaining}",
        ru: "Подготовка перед воспроизведением · {progress}% · {visited}/{total} кадров · {remaining}",
      },
      updatingCache: {
        en: "Updating preview · {restored}/{segments} segments reused · {progress}% · {visited}/{total} frames · {remaining}",
        ru: "Обновление превью · повторно используется {restored}/{segments} сегментов · {progress}% · {visited}/{total} кадров · {remaining}",
      },
      pausePreparation: {
        en: "Pause preview preparation",
        ru: "Приостановить подготовку превью",
      },
      resumePreparation: {
        en: "Continue preview preparation",
        ru: "Продолжить подготовку превью",
      },
      rendererRecovering: {
        en: "Preview renderer is restarting",
        ru: "Перезапуск рендерера предпросмотра",
      },
      restoringCache: {
        en: "Restoring saved preview",
        ru: "Восстановление сохранённого превью",
      },
    },
    renderer: {
      affectsCurrentFrame: {
        en: "Affects current frame",
        ru: "Влияет на текущий кадр",
      },
      bindings: { en: "Renderer bindings", ru: "Связи рендерера" },
      coverage: {
        en: "{bound}/{total} timeline items affect the current frame",
        ru: "{bound}/{total} элементов таймлайна влияют на текущий кадр",
      },
      noBindings: { en: "No renderer bindings.", ru: "Нет связей рендерера." },
      notReadNow: {
        en: "Editable, not read now",
        ru: "Редактируется, сейчас не используется",
      },
      types: {
        control: { en: "Control", ru: "Параметр" },
        clip: { en: "Layer interval", ru: "Интервал слоя" },
        layer: { en: "Layer", ru: "Слой" },
        phase: { en: "Phase", ru: "Фаза" },
        track: { en: "Track", ru: "Трек" },
      },
    },
    rendering: {
      bitmapUnavailable: {
        en: "Rendered frame is unavailable.",
        ru: "Готовое изображение кадра недоступно.",
      },
      canvasContextUnavailable: {
        en: "Canvas 2D context is unavailable.",
        ru: "Контекст Canvas 2D недоступен.",
      },
      backgroundStopped: {
        en: "Background renderer stopped. Switching to compatibility mode.",
        ru: "Фоновый рендерер остановлен. Включается режим совместимости.",
      },
      failed: { en: "Render failed.", ru: "Не удалось отрисовать кадр." },
      frameStats: {
        en: "{type} · {duration} ms frame · {average} ms average · {stale} stale",
        ru: "{type} · кадр {duration} мс · среднее {average} мс · устаревших: {stale}",
      },
      moduleLoadFailed: {
        en: "Failed to load module {module}.",
        ru: "Не удалось загрузить модуль {module}.",
      },
      rendering: { en: "Rendering…", ru: "Рендеринг…" },
      restartingAfterTimeout: {
        en: "Preview renderer did not respond and is restarting.",
        ru: "Рендерер предпросмотра не ответил и перезапускается.",
      },
      workerPreparationFailed: {
        en: "Could not prepare this frame for background rendering.",
        ru: "Не удалось подготовить кадр для фонового рендеринга.",
      },
    },
    selection: {
      none: { en: "No selection", ru: "Нет выделения" },
      types: {
        asset: { en: "Asset", ru: "Ассет" },
        clip: { en: "Clip", ru: "Клип" },
        composition: { en: "Composition", ru: "Композиция" },
        control: { en: "Control", ru: "Параметр" },
        effect: { en: "Effect", ru: "Эффект" },
        keyframe: { en: "Keyframe", ru: "Ключевой кадр" },
        layer: { en: "Layer", ru: "Слой" },
        phase: { en: "Phase", ru: "Фаза" },
        preset: { en: "Preset", ru: "Пресет" },
        scene: { en: "Scene", ru: "Сцена" },
        track: { en: "Track", ru: "Трек" },
      },
      hints: {
        clickTimeline: {
          en: "Click timeline to seek",
          ru: "Щёлкните по таймлайну для перехода",
        },
        dragBlockOnly: {
          en: "Drag block only",
          ru: "Перетаскивается только блок",
        },
        dragClipOnly: {
          en: "Drag clip only",
          ru: "Перетаскивается только клип",
        },
        dragKeyOrCurve: {
          en: "Drag key or edit curve",
          ru: "Перетащите ключ или настройте кривую",
        },
        editKeyframes: {
          en: "Edit selected keyframes",
          ru: "Изменить выбранные ключевые кадры",
        },
        dragOntoCanvas: {
          en: "Drag onto canvas",
          ru: "Перетащите на канвас",
        },
        dragPhaseOnly: {
          en: "Drag phase only",
          ru: "Перетаскивается только фаза",
        },
        dragTrackKeys: {
          en: "Drag row keys",
          ru: "Перетащите ключи строки",
        },
        dragWithKeys: {
          en: "Drag with keys",
          ru: "Перетаскивается вместе с ключами",
        },
        dragWithLinks: {
          en: "Drag with links",
          ru: "Перетаскивается вместе со связями",
        },
        editLayerProperties: {
          en: "Edit layer properties",
          ru: "Настройте свойства слоя",
        },
      },
      meta: {
        asset: { en: "asset", ru: "ассет" },
        composition: {
          en: "{layers} layers · {tracks} tracks",
          ru: "Слоёв: {layers} · треков: {tracks}",
        },
        keyframes: {
          en: "{count} keyframes",
          ru: "Ключевых кадров: {count}",
        },
      },
    },
    sidebar: {
      workspace: { en: "Workspace", ru: "Рабочая область" },
      inspector: { en: "Inspector", ru: "Инспектор" },
      effect: { en: "Effect", ru: "Эффект" },
      review: { en: "Review", ru: "Проверка" },
      hidePanel: { en: "Hide panel", ru: "Скрыть панель" },
      hidePanelShortcut: {
        en: "Hide panel (Ctrl+B)",
        ru: "Скрыть панель (Ctrl+B)",
      },
      showPanel: { en: "Show panel", ru: "Показать панель" },
      showPanelShortcut: {
        en: "Show panel (Ctrl+B)",
        ru: "Показать панель (Ctrl+B)",
      },
    },
    controls: {
      visualPreset: { en: "Visual style", ru: "Визуальный стиль" },
      customVisualPreset: { en: "Custom", ru: "Свои настройки" },
      title: { en: "Controls", ru: "Параметры" },
      caption: {
        en: "Composition parameters",
        ru: "Параметры композиции",
      },
      empty: {
        en: "This composition has no custom controls.",
        ru: "У этой композиции нет дополнительных параметров.",
      },
      sliderLabel: {
        en: "{label} slider",
        ru: "Ползунок «{label}»",
      },
      colorPicker: { en: "Color picker", ru: "Выбор цвета" },
      colorPickerLabel: {
        en: "{label} color picker",
        ru: "Выбор цвета «{label}»",
      },
      colorValue: { en: "CSS color value", ru: "Значение CSS-цвета" },
      colorValueLabel: {
        en: "{label} CSS value",
        ru: "CSS-значение «{label}»",
      },
      invalidColor: {
        en: "Enter a CSS color or none.",
        ru: "Введите CSS-цвет или none.",
      },
      valueLabel: {
        en: "{label} value",
        ru: "Значение «{label}»",
      },
    },
    presets: {
      title: { en: "Presets", ru: "Пресеты" },
      caption: { en: "Reusable editor states", ru: "Сохраненные состояния" },
      saveCurrent: { en: "Save current", ru: "Сохранить" },
      duplicate: { en: "Duplicate", ru: "Дублировать" },
      delete: { en: "Delete", ru: "Удалить" },
      select: {
        en: "Select preset {preset}",
        ru: "Выбрать пресет «{preset}»",
      },
      empty: {
        en: "Save the current editor state as a reusable preset.",
        ru: "Сохраните текущее состояние, чтобы использовать его повторно.",
      },
      unavailableWithoutControls: {
        en: "Presets become available when the composition has adjustable parameters.",
        ru: "Пресеты доступны, когда у композиции есть настраиваемые параметры.",
      },
      selectToDuplicate: {
        en: "Select a preset to duplicate it.",
        ru: "Выберите пресет, чтобы дублировать его.",
      },
      hint: {
        en: "Presets store controls, duration, layers, clips, and timeline.",
        ru: "Пресет сохраняет параметры, длительность, слои, клипы и таймлайн.",
      },
      meta: {
        en: "{duration}s · {tracks} tracks",
        ru: "{duration}с · треков: {tracks}",
      },
      saved: {
        en: "Saved preset {preset}",
        ru: "Пресет «{preset}» сохранен",
      },
      duplicated: {
        en: "Duplicated preset {preset}",
        ru: "Создана копия пресета «{preset}»",
      },
      applied: {
        en: "Applied preset {preset}",
        ru: "Применен пресет «{preset}»",
      },
      deleted: {
        en: "Deleted preset {preset}",
        ru: "Пресет «{preset}» удален",
      },
    },
    health: {
      validation: { en: "Validation", ru: "Готовность" },
      renderer: { en: "Renderer", ru: "Рендерер" },
      diagnostics: { en: "Log", ru: "Журнал" },
      copyDiagnostics: { en: "Copy log", ru: "Скопировать журнал" },
      diagnosticsCopied: { en: "Log copied", ru: "Журнал скопирован" },
      diagnosticsCopyFailed: {
        en: "Could not copy the log",
        ru: "Не удалось скопировать журнал",
      },
      diagnosticsEmpty: { en: "Log is empty", ru: "Журнал пуст" },
    },
    status: {
      noFileBound: { en: "No source file open", ru: "Исходный файл не открыт" },
      sourceFileBound: {
        en: "Bound {file}",
        ru: "Привязан файл {file}",
      },
      sourceFileSaved: { en: "Saved {file}", ru: "Сохранён файл {file}" },
      templateJsonFile: { en: "Template JSON", ru: "JSON шаблона" },
      fileSystemAccessUnavailable: {
        en: "File System Access API unavailable; use Export JSON.",
        ru: "Доступ к файловой системе недоступен; используйте экспорт JSON.",
      },
      bindCanceledOrFailed: {
        en: "Bind canceled or failed",
        ru: "Привязка отменена или не удалась",
      },
      rejectedMismatchedJson: {
        en: "Rejected mismatched JSON",
        ru: "Отклонён JSON другого шаблона",
      },
      rejectedInvalidJson: {
        en: "Rejected invalid JSON",
        ru: "Отклонён некорректный JSON",
      },
      saveFailed: { en: "Save failed", ru: "Не удалось сохранить" },
      exportedJsonDownload: {
        en: "Exported JSON download",
        ru: "JSON экспортирован для скачивания",
      },
      rendererContractCheckPending: {
        en: "Waiting for renderer contract check.",
        ru: "Ожидаем завершения проверки контракта рендерера.",
      },
      currentJsonValidForExport: {
        en: "Current effect JSON is valid for export.",
        ru: "Текущий JSON эффекта готов к экспорту.",
      },
      effectDocumentNotExportable: {
        en: "This effect cannot be exported because it is not a strict Effect v1 graph document.",
        ru: "Эффект нельзя экспортировать: это не строгий документ с графом Effect v1.",
      },
      validationIssueCount: {
        en: "Validation issues: {count}",
        ru: "Проблем при проверке: {count}",
      },
      loadedPack: { en: "Loaded {pack}", ru: "Загружен пакет {pack}" },
      loadedLocalEffects: {
        en: "Loaded {count} local effects",
        ru: "Загружено локальных эффектов: {count}",
      },
      readyForImport: {
        en: "Ready to import an effect package",
        ru: "Готово к импорту пакета эффектов",
      },
      packValidationFailed: {
        en: "Validation failed",
        ru: "Ошибка проверки",
      },
      rejectedMalformedJson: {
        en: "Rejected malformed JSON",
        ru: "Некорректный JSON отклонен",
      },
    },
    templates: {
      pickerLabel: {
        en: "Choose an item to edit",
        ru: "Выбор редактируемого элемента",
      },
      importPrompt: {
        en: "Import an effect package",
        ru: "Импортируйте пакет эффектов",
      },
      noResults: { en: "Nothing found", ru: "Ничего не найдено" },
      other: { en: "Other", ru: "Другое" },
      searchPlaceholder: {
        en: "Search by name or ID",
        ru: "Поиск по названию или ID",
      },
      searchLabel: {
        en: "Filter compositions",
        ru: "Фильтр композиций",
      },
      rendererTypes: {
        dom: { ru: "HTML", en: "HTML" },
        composition: { en: "Composition", ru: "Композиция" },
        effect: { en: "Effect", ru: "Эффект" },
      },
      artifactTypes: {
        animation: { en: "Animation", ru: "Анимация" },
        transition: { en: "Transition", ru: "Переход" },
      },
      artifactTypeGroups: {
        animation: { en: "Animations", ru: "Анимации" },
        transition: { en: "Transitions", ru: "Переходы" },
      },
      artifactDescriptions: {
        animation: {
          en: "Renders an independent timeline animation.",
          ru: "Самостоятельная анимация со своей временной шкалой.",
        },
        transition: {
          en: "Blends previous and next frames at a transition boundary.",
          ru: "Соединяет предыдущий и следующий кадры на границе перехода.",
        },
      },
      bundleKinds: {
        dom: { ru: "HTML-сцена", en: "HTML scene" },
        standalone: { en: "Standalone", ru: "Самостоятельная сцена" },
        targetEffect: { en: "Target effect", ru: "Эффект на медиа" },
        transition: { en: "Transition", ru: "Переход" },
      },
      bundleKindGroups: {
        dom: { ru: "HTML-сцены", en: "HTML scenes" },
        standalone: { en: "Standalone", ru: "Самостоятельные" },
        targetEffect: { en: "Target effects", ru: "Эффекты на медиа" },
        transition: { en: "Transitions", ru: "Переходы" },
      },
      bundleKindDescriptions: {
        dom: {
          ru: "Живая HTML-страница с послойной сборкой в перспективе.",
          en: "A live HTML page assembled in perspective.",
        },
        standalone: {
          en: "A self-contained scene with its own timeline.",
          ru: "Самостоятельная сцена с собственной временной шкалой.",
        },
        targetEffect: {
          en: "An effect applied to temporary source image or video.",
          ru: "Эффект поверх временно выбранного изображения или видео.",
        },
        transition: {
          en: "A transition between temporary from and to media.",
          ru: "Переход между двумя временно выбранными медиафайлами.",
        },
      },
      summary: {
        en: "{layers} layers · {tracks} tracks · {duration}",
        ru: "Слоёв: {layers} · треков: {tracks} · {duration}",
      },
    },
    time: {
      secondsUnit: { en: "s", ru: "с" },
      zeroSeconds: { en: "0.000s", ru: "0.000с" },
    },
    theme: {
      dark: { en: "Dark theme", ru: "Темная тема" },
      light: { en: "Light theme", ru: "Светлая тема" },
      useDark: { en: "Switch to dark theme", ru: "Включить темную тему" },
      useLight: { en: "Switch to light theme", ru: "Включить светлую тему" },
    },
    validation: {
      checkingRendererContract: {
        en: "Checking renderer contract…",
        ru: "Проверяем контракт рендерера…",
      },
      categories: {
        assets: { en: "Assets", ru: "Ассеты" },
        contract: { en: "Contract", ru: "Контракт" },
        refs: { en: "References", ru: "Связи" },
        renderer: { en: "Renderer", ru: "Рендерер" },
        schema: { en: "Schema", ru: "Схема" },
        security: { en: "Security", ru: "Безопасность" },
        timing: { en: "Timing", ru: "Время" },
      },
      issueCount: {
        en: "Validation issues: {count}",
        ru: "Проблем проверки: {count}",
      },
      messages: {
        assetUnsafePath: {
          en: 'Asset "{asset}" has unsafe local path "{path}"',
          ru: "У ассета «{asset}» небезопасный локальный путь «{path}»",
        },
        assetUnsafeSvg: {
          en: 'Asset "{asset}" contains unsafe SVG content',
          ru: "Ассет «{asset}» содержит небезопасный SVG-код",
        },
        clipMissingLayer: {
          en: 'Clip references missing layer "{layer}"',
          ru: "Клип ссылается на отсутствующий слой «{layer}»",
        },
        clipMissingScene: {
          en: 'Clip "{clip}" references missing scene "{scene}"',
          ru: "Клип «{clip}» ссылается на отсутствующую сцену «{scene}»",
        },
        clipOutsideEffect: {
          en: 'Clip "{clip}" is outside effect duration',
          ru: "Клип «{clip}» выходит за длительность эффекта",
        },
        clipOutsideScene: {
          en: 'Clip "{clip}" is outside scene "{scene}"',
          ru: "Клип «{clip}» выходит за границы сцены «{scene}»",
        },
        duplicateLayerId: {
          en: 'Duplicate layer id "{id}"',
          ru: "Повторяется ID слоя «{id}»",
        },
        duplicatePhaseId: {
          en: 'Duplicate phase id "{id}"',
          ru: "Повторяется ID фазы «{id}»",
        },
        duplicatePresetId: {
          en: 'Duplicate preset id "{id}"',
          ru: "Повторяется ID пресета «{id}»",
        },
        duplicateSceneId: {
          en: 'Duplicate scene id "{id}"',
          ru: "Повторяется ID сцены «{id}»",
        },
        duplicateTrackId: {
          en: 'Duplicate track id "{id}"',
          ru: "Повторяется ID трека «{id}»",
        },
        invalidEditorStructure: {
          en: "Invalid editor document field at {path}",
          ru: "Неверное поле документа редактора: {path}",
        },
        effectDurationPositive: {
          en: "Effect duration must be a positive number",
          ru: "Длительность эффекта должна быть положительным числом",
        },
        keyframeForeignPhase: {
          en: 'Keyframe "{keyframe}" in "{track}" references phase "{phase}" owned by another layer',
          ru: "Ключ «{keyframe}» трека «{track}» ссылается на фазу «{phase}» другого слоя",
        },
        keyframeMissingPhase: {
          en: 'Keyframe "{keyframe}" in "{track}" references missing phase "{phase}"',
          ru: "Ключ «{keyframe}» трека «{track}» ссылается на отсутствующую фазу «{phase}»",
        },
        keyframeMissingScene: {
          en: 'Keyframe "{keyframe}" in "{track}" references missing scene "{scene}"',
          ru: "Ключ «{keyframe}» трека «{track}» ссылается на отсутствующую сцену «{scene}»",
        },
        keyframeOutsideEffect: {
          en: 'Keyframe "{keyframe}" in "{track}" is outside effect duration',
          ru: "Ключ «{keyframe}» трека «{track}» выходит за длительность эффекта",
        },
        keyframeOutsidePhase: {
          en: 'Keyframe "{keyframe}" in "{track}" is outside phase "{phase}"',
          ru: "Ключ «{keyframe}» трека «{track}» выходит за границы фазы «{phase}»",
        },
        keyframeOutsideScene: {
          en: 'Keyframe "{keyframe}" in "{track}" is outside scene "{scene}"',
          ru: "Ключ «{keyframe}» трека «{track}» выходит за границы сцены «{scene}»",
        },
        layerMissingAsset: {
          en: 'Layer "{layer}" references missing asset "{asset}"',
          ru: "Слой «{layer}» ссылается на отсутствующий ассет «{asset}»",
        },
        layerMissingId: {
          en: "Layer is missing id",
          ru: "У слоя отсутствует ID",
        },
        layerMissingParent: {
          en: 'Layer "{layer}" references missing parent "{parent}"',
          ru: "Слой «{layer}» ссылается на отсутствующего родителя «{parent}»",
        },
        layerGroupClip: {
          en: 'Group "{group}" cannot own a clip',
          ru: "Группа «{group}» не может владеть клипом",
        },
        layerGroupDepth: {
          en: 'Layer "{layer}" exceeds maximum group depth {depth}',
          ru: "Слой «{layer}» превышает максимальную глубину групп {depth}",
        },
        layerGroupNonContiguous: {
          en: 'Group "{group}" has a non-contiguous layer subtree',
          ru: "Поддерево группы «{group}» разорвано в порядке слоёв",
        },
        layerGroupTrack: {
          en: 'Group "{group}" cannot own animation track "{track}"',
          ru: "Группа «{group}» не может владеть треком анимации «{track}»",
        },
        layerHierarchyCycle: {
          en: 'Layer hierarchy contains a cycle at "{layer}"',
          ru: "Иерархия слоёв содержит цикл у «{layer}»",
        },
        layerSelfParent: {
          en: 'Layer "{layer}" cannot parent itself',
          ru: "Слой «{layer}» не может быть родителем самому себе",
        },
        layerParentNotGroup: {
          en: 'Layer "{layer}" references non-group parent "{parent}"',
          ru: "Слой «{layer}» ссылается на родителя «{parent}», который не является группой",
        },
        noTemplateSelected: {
          en: "No template selected",
          ru: "Шаблон не выбран",
        },
        phaseMissingId: {
          en: "Phase is missing id",
          ru: "У фазы отсутствует ID",
        },
        phaseMissingScene: {
          en: 'Phase "{phase}" references missing scene "{scene}"',
          ru: "Фаза «{phase}» ссылается на отсутствующую сцену «{scene}»",
        },
        phaseOutsideEffect: {
          en: 'Phase "{phase}" is outside effect duration',
          ru: "Фаза «{phase}» выходит за длительность эффекта",
        },
        phaseOutsideScene: {
          en: 'Phase "{phase}" is outside scene "{scene}"',
          ru: "Фаза «{phase}» выходит за границы сцены «{scene}»",
        },
        presetMissingId: {
          en: "Preset is missing id",
          ru: "У пресета отсутствует ID",
        },
        presetPrefix: {
          en: 'Preset "{preset}": {message}',
          ru: "Пресет «{preset}»: {message}",
        },
        rendererClipGate: {
          en: 'Renderer contract violation: clip for layer "{layer}" is not gated with resolveLayer/isLayerActive',
          ru: "Нарушение контракта рендерера: клип слоя «{layer}» не проверяется через resolveLayer/isLayerActive",
        },
        rendererControlUnread: {
          en: 'Renderer contract violation: control "{control}" is not read',
          ru: "Нарушение контракта рендерера: параметр «{control}» не читается",
        },
        rendererLayerGate: {
          en: 'Renderer contract violation: visual layer "{layer}" is not gated with resolveLayer/isLayerActive',
          ru: "Нарушение контракта рендерера: визуальный слой «{layer}» не проверяется через resolveLayer/isLayerActive",
        },
        rendererPhaseUnread: {
          en: 'Renderer contract violation: phase "{phase}" is not read',
          ru: "Нарушение контракта рендерера: фаза «{phase}» не читается",
        },
        rendererTrackGate: {
          en: 'Renderer contract violation: track "{track}" is read without gating layer "{layer}"',
          ru: "Нарушение контракта рендерера: трек «{track}» читается без проверки слоя «{layer}»",
        },
        rendererTrackUnread: {
          en: 'Renderer contract violation: track "{track}" is not read',
          ru: "Нарушение контракта рендерера: трек «{track}» не читается",
        },
        sceneMissingId: {
          en: "Scene is missing id",
          ru: "У сцены отсутствует ID",
        },
        sceneOutsideEffect: {
          en: 'Scene "{scene}" is outside effect duration',
          ru: "Сцена «{scene}» выходит за длительность эффекта",
        },
        templateMissingAsset: {
          en: 'Template references missing asset "{asset}"',
          ru: "Шаблон ссылается на отсутствующий ассет «{asset}»",
        },
        trackMissingId: {
          en: "Track is missing id",
          ru: "У трека отсутствует ID",
        },
        trackMissingLayer: {
          en: 'Track "{track}" references missing layer "{layer}"',
          ru: "Трек «{track}» ссылается на отсутствующий слой «{layer}»",
        },
        trackMissingPhase: {
          en: 'Track "{track}" references missing phase "{phase}"',
          ru: "Трек «{track}» ссылается на отсутствующую фазу «{phase}»",
        },
        trackMissingScene: {
          en: 'Track "{track}" references missing scene "{scene}"',
          ru: "Трек «{track}» ссылается на отсутствующую сцену «{scene}»",
        },
      },
      missingValue: { en: "not set", ru: "не задано" },
      noTemplate: { en: "No template", ru: "Нет шаблона" },
      validForExport: { en: "Valid for export", ru: "Готово к экспорту" },
    },
    assets: {
      addLayer: { en: "Add Layer", ru: "Добавить слой" },
      hint: {
        en: "Drag to canvas, replace by stable id, remove only when unused.",
        ru: "Перетащите на canvas, заменяйте по стабильному id, удаляйте только неиспользуемые.",
      },
      missingAsset: { en: "missing asset", ru: "ассет отсутствует" },
      unusedCanRemove: {
        en: "Unused asset can be removed.",
        ru: "Неиспользуемый ассет можно удалить.",
      },
      remove: { en: "Remove", ru: "Удалить" },
      replace: { en: "Replace", ru: "Заменить" },
      selectAsset: { en: "Select asset", ru: "Выбрать ассет" },
      sourcePathTitle: {
        en: "Display/source path saved in effect file",
        ru: "Отображаемый путь к исходнику, сохраняемый в файле эффекта",
      },
      used: { en: "used", ru: "используется" },
    },
  },
} as const;
