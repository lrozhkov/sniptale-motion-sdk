import {
  formatAssetMeta,
  getAssetPreviewUrl,
  getAssetUsageCount,
} from "./model.js";

type AssetPanelTranslate = (key: string, fallback?: string) => string;
type AssetPanelLabels = {
  missingAsset: string;
  used: string;
};

type AssetPanelOptions = {
  assets: Map<string, any>;
  container: HTMLElement;
  effectiveTemplate: any;
  onAddAssetLayer: (asset: any) => void;
  onRemoveAsset: (assetId: string) => void;
  onRenameAssetPath: (assetId: string, path: string) => void;
  onReplaceAsset: (assetId: string) => void;
  onSelectAsset: (assetId: string) => void;
  selectedItem: any;
  template: any;
  translate: AssetPanelTranslate;
};

export type AssetPanelItem = {
  asset: any;
  assetId: string;
  draggable: boolean;
  meta: string;
  missing: boolean;
  pathValue: string;
  previewUrl: string | null;
  selected: boolean;
  usageCount: number;
};

export function buildAssetPanelItems(options: {
  assets: Map<string, any>;
  effectiveTemplate: any;
  labels?: Partial<AssetPanelLabels>;
  selectedItem: any;
}): AssetPanelItem[] {
  const labels = {
    missingAsset: options.labels?.missingAsset ?? "missing asset",
    used: options.labels?.used ?? "used",
  };
  const assetIds = Array.isArray(options.effectiveTemplate?.assets)
    ? options.effectiveTemplate.assets
    : [];
  return assetIds.map((assetId) => {
    const asset = options.assets.get(assetId);
    const usageCount = getAssetUsageCount(options.effectiveTemplate, assetId);
    return {
      asset,
      assetId,
      draggable: Boolean(asset),
      meta: asset
        ? `${formatAssetMeta(asset)} · ${labels.used} ${usageCount}`
        : labels.missingAsset,
      missing: !asset,
      pathValue: asset?.path || assetId,
      previewUrl: asset ? getAssetPreviewUrl(asset) : null,
      selected:
        options.selectedItem?.type === "asset" &&
        options.selectedItem.assetId === assetId,
      usageCount,
    };
  });
}

export function renderAssetsPanel(options: AssetPanelOptions): void {
  const { container, effectiveTemplate, template, translate } = options;
  container.innerHTML = "";
  if (!template || !effectiveTemplate) {
    container.textContent = translate("common.empty.assets", "No assets");
    return;
  }
  const items = buildAssetPanelItems({
    ...options,
    labels: {
      missingAsset: translate("viewer.assets.missingAsset", "missing asset"),
      used: translate("viewer.assets.used", "used"),
    },
  });
  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "assets-hint";
    empty.textContent = translate(
      "common.empty.assets",
      "No assets in this effect. Import one from Layers.",
    );
    container.append(empty);
    return;
  }
  const hint = document.createElement("div");
  hint.className = "assets-hint";
  hint.textContent = translate(
    "viewer.assets.hint",
    "Drag to canvas, replace by stable id, remove only when unused.",
  );
  container.append(hint);

  for (const item of items) {
    container.append(renderAssetRow(item, options));
  }
}

function renderAssetRow(
  item: AssetPanelItem,
  options: AssetPanelOptions,
): HTMLElement {
  const row = document.createElement("div");
  row.className = `asset-row${item.missing ? " missing-asset" : ""}${
    item.selected ? " selected" : ""
  }`;
  row.dataset.assetId = item.assetId;
  row.draggable = item.draggable;
  row.tabIndex = 0;
  row.setAttribute("role", "button");
  row.setAttribute(
    "aria-label",
    `${options.translate("viewer.assets.selectAsset", "Select asset")} ${
      item.assetId
    }`,
  );
  row.addEventListener("click", () => options.onSelectAsset(item.assetId));
  row.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      options.onSelectAsset(item.assetId);
    }
  });
  row.addEventListener("dragstart", (event) => {
    if (!item.asset || !event.dataTransfer) {
      return;
    }
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-sniptale-asset", item.assetId);
    event.dataTransfer.setData("text/plain", item.assetId);
  });

  const thumbnail = document.createElement("div");
  thumbnail.className = "asset-thumbnail";
  if (item.previewUrl) {
    const image = document.createElement("img");
    image.alt = "";
    image.src = item.previewUrl;
    thumbnail.append(image);
  } else {
    thumbnail.textContent = item.assetId.slice(0, 2).toUpperCase();
  }

  const summary = document.createElement("div");
  summary.className = "asset-summary";
  const title = document.createElement("strong");
  title.textContent = item.assetId;
  const meta = document.createElement("span");
  meta.textContent = item.meta;
  const pathInput = document.createElement("input");
  pathInput.className = "asset-path-input";
  pathInput.dataset.assetId = item.assetId;
  pathInput.value = item.pathValue;
  pathInput.disabled = item.missing;
  pathInput.title = options.translate(
    "viewer.assets.sourcePathTitle",
    "Display/source path saved in effect file",
  );
  pathInput.addEventListener("change", () =>
    options.onRenameAssetPath(item.assetId, pathInput.value),
  );
  pathInput.addEventListener("click", (event) => event.stopPropagation());
  pathInput.addEventListener("mousedown", (event) => event.stopPropagation());
  summary.append(title, meta, pathInput);

  const actions = document.createElement("div");
  actions.className = "asset-actions";
  actions.addEventListener("click", (event) => event.stopPropagation());
  const addButton = createActionButton(
    "asset-add-layer-button",
    options.translate("viewer.assets.addLayer", "Add Layer"),
    item.missing,
    () => {
      if (item.asset) {
        options.onAddAssetLayer(item.asset);
      }
    },
  );
  const replaceButton = createActionButton(
    "asset-replace-button",
    options.translate("viewer.assets.replace", "Replace"),
    false,
    () => options.onReplaceAsset(item.assetId),
  );
  const removeButton = createActionButton(
    "asset-remove-button",
    options.translate("viewer.assets.remove", "Remove"),
    item.missing,
    () => {
      options.onRemoveAsset(item.assetId);
    },
  );
  removeButton.dataset.assetUsage = String(item.usageCount);
  actions.append(addButton, replaceButton, removeButton);
  row.append(thumbnail, summary, actions);
  return row;
}

function createActionButton(
  className: string,
  text: string,
  disabled: boolean,
  onClick: (button: HTMLButtonElement) => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  button.disabled = disabled;
  button.addEventListener("click", () => onClick(button));
  return button;
}
