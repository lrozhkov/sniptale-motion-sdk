import {
  ChartSpline,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  Database,
  Download,
  Eye,
  EyeOff,
  FileInput,
  FileJson,
  FileOutput,
  Focus,
  FolderOpen,
  Import,
  Lock,
  Maximize2,
  Menu,
  Minimize2,
  Moon,
  Pause,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Power,
  PowerOff,
  Repeat2,
  Redo2,
  RotateCcw,
  Save,
  ScanSearch,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Unlock,
  Undo2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
  createElement,
} from "lucide";

const ICONS = {
  graph: ChartSpline,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  collapseAll: ChevronsDownUp,
  copy: Copy,
  database: Database,
  expandAll: ChevronsUpDown,
  download: Download,
  eye: Eye,
  eyeOff: EyeOff,
  fileInput: FileInput,
  fileJson: FileJson,
  fileOutput: FileOutput,
  focus: Focus,
  folderOpen: FolderOpen,
  import: Import,
  lock: Lock,
  maximize: Maximize2,
  menu: Menu,
  minimize: Minimize2,
  moon: Moon,
  panelRightClose: PanelRightClose,
  panelRightOpen: PanelRightOpen,
  pause: Pause,
  play: Play,
  power: Power,
  powerOff: PowerOff,
  repeat: Repeat2,
  redo: Redo2,
  reset: RotateCcw,
  save: Save,
  scanSearch: ScanSearch,
  search: Search,
  settings: Settings,
  shieldCheck: ShieldCheck,
  sliders: SlidersHorizontal,
  sun: Sun,
  unlock: Unlock,
  undo: Undo2,
  upload: Upload,
  x: X,
  zoomIn: ZoomIn,
  zoomOut: ZoomOut,
} as const;

export type ViewerIconName = keyof typeof ICONS;

export function createViewerIcon(name: ViewerIconName): SVGElement {
  const svg = createElement(ICONS[name], {
    "aria-hidden": "true",
    class: "viewer-icon",
    height: "16",
    width: "16",
  });
  return svg;
}

export function setIconButton(
  button: HTMLButtonElement | null | undefined,
  iconName: ViewerIconName,
  label: string,
  options: { showText?: boolean } = {},
): void {
  if (!button) {
    return;
  }
  button.replaceChildren(createViewerIcon(iconName));
  if (options.showText) {
    const text = document.createElement("span");
    text.className = "button-label";
    text.textContent = label;
    button.append(text);
  }
  button.ariaLabel = label;
  button.title = label;
}

export function createIconActions() {
  return { createViewerIcon, setIconButton };
}

export function isViewerIconName(value: unknown): value is ViewerIconName {
  return typeof value === "string" && Object.hasOwn(ICONS, value);
}
