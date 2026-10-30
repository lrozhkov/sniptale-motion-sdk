import type { ViewerAppContext } from "./context.js";

const STORAGE_KEY = "effect-sdk-viewer-theme";
const THEMES = new Set(["dark", "light"]);
const themeRenderGenerations = new WeakMap<ViewerAppContext, number>();

interface ApplyThemeOptions {
  persist?: boolean;
}

function getStoredTheme(ctx: ViewerAppContext) {
  try {
    const value = window.localStorage?.getItem(STORAGE_KEY);
    return THEMES.has(value ?? "") ? value : null;
  } catch {
    return null;
  }
}

function persistTheme(theme) {
  try {
    window.localStorage?.setItem(STORAGE_KEY, theme);
  } catch {
    // Theme persistence is best-effort because browser storage can be blocked.
  }
}

function applyTheme(
  ctx: ViewerAppContext,
  theme,
  options: ApplyThemeOptions = {},
) {
  const nextTheme = THEMES.has(theme) ? theme : "dark";
  const themeChanged = ctx.state.theme !== nextTheme;
  const snapshotPreserved =
    themeChanged &&
    Boolean(ctx.state.currentTemplate) &&
    !ctx.state.playing &&
    preserveThemePreviewSnapshot(ctx);
  ctx.state.theme = nextTheme;
  document.documentElement.dataset.theme = nextTheme;
  if (options.persist !== false) {
    persistTheme(nextTheme);
  }
  ctx.syncThemeButton();
  if (themeChanged && ctx.state.currentTemplate) {
    const generation = (themeRenderGenerations.get(ctx) ?? 0) + 1;
    themeRenderGenerations.set(ctx, generation);
    window.requestAnimationFrame(async () => {
      try {
        if (ctx.state.theme === nextTheme) {
          await ctx.renderCurrentFrame({ forceFull: true });
        }
      } finally {
        if (
          snapshotPreserved &&
          themeRenderGenerations.get(ctx) === generation
        ) {
          await waitForThemePreviewPaint();
          if (themeRenderGenerations.get(ctx) === generation) {
            ctx.refs.themePreviewSnapshotCanvas.hidden = true;
          }
        }
      }
    });
  }
}

function waitForThemePreviewPaint(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function preserveThemePreviewSnapshot(ctx: ViewerAppContext): boolean {
  const source = ctx.refs.canvas as HTMLCanvasElement;
  const snapshot = ctx.refs.themePreviewSnapshotCanvas as HTMLCanvasElement;
  const context = snapshot?.getContext?.("2d");
  if (!source || !snapshot || !context) {
    return false;
  }
  try {
    if (snapshot.width !== source.width) {
      snapshot.width = source.width;
    }
    if (snapshot.height !== source.height) {
      snapshot.height = source.height;
    }
    context.clearRect(0, 0, snapshot.width, snapshot.height);
    context.drawImage(source, 0, 0);
    snapshot.hidden = false;
    return true;
  } catch {
    snapshot.hidden = true;
    return false;
  }
}

function toggleTheme(ctx: ViewerAppContext) {
  ctx.applyTheme(ctx.state.theme === "dark" ? "light" : "dark");
}

function initializeTheme(ctx: ViewerAppContext) {
  ctx.applyTheme(getStoredTheme(ctx) ?? "dark", {
    persist: false,
  });
}

function syncThemeButton(ctx: ViewerAppContext) {
  const isDark = ctx.state.theme === "dark";
  ctx.refs.themeToggleButton?.setAttribute("aria-pressed", String(!isDark));
  ctx.setIconButton(
    ctx.refs.themeToggleButton,
    isDark ? "sun" : "moon",
    isDark
      ? ctx.deps.t("viewer.theme.useLight", "Switch to light theme")
      : ctx.deps.t("viewer.theme.useDark", "Switch to dark theme"),
  );
}

export function installAppThemeOwner(ctx: ViewerAppContext): void {
  ctx.applyTheme = applyTheme.bind(undefined, ctx);
  ctx.toggleTheme = toggleTheme.bind(undefined, ctx);
  ctx.initializeTheme = initializeTheme.bind(undefined, ctx);
  ctx.syncThemeButton = syncThemeButton.bind(undefined, ctx);
}
