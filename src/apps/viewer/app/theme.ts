import { bindViewerAction } from "./bind-action.js";
import type { ThemeActions } from "./shell-contract.js";
import type { ViewerAppContext } from "./context.js";

const STORAGE_KEY = "effect-sdk-viewer-theme";
const THEMES = new Set(["dark", "light"]);
const themeRenderGenerations = new WeakMap<ViewerAppContext, number>();

interface ApplyThemeOptions {
  persist?: boolean;
}

function getStoredTheme() {
  try {
    const value = window.localStorage?.getItem(STORAGE_KEY);
    return THEMES.has(value ?? "") ? value : null;
  } catch {
    return null;
  }
}

function persistTheme(theme: string) {
  try {
    window.localStorage?.setItem(STORAGE_KEY, theme);
  } catch {
    // Theme persistence is best-effort because browser storage can be blocked.
  }
}

function applyTheme(
  ctx: ViewerAppContext,
  theme: unknown,
  options: ApplyThemeOptions = {},
) {
  const nextTheme = theme === "light" ? "light" : "dark";
  const themeChanged = ctx.state.theme !== nextTheme;
  if (themeChanged && ctx.state.currentTemplate && !ctx.state.playing)
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
    const source = ctx.state.currentTemplate;
    window.requestAnimationFrame(() => {
      void refreshThemePreview(ctx, nextTheme, source, generation).catch(
        (error: unknown) => {
          if (
            themeRenderGenerations.get(ctx) !== generation ||
            ctx.state.currentTemplate !== source ||
            ctx.state.theme !== nextTheme
          )
            return;
          ctx.setRenderStatus("failed");
          if (error instanceof Error) ctx.logDiagnostic(error.message, "error");
        },
      );
    });
  }
}

async function refreshThemePreview(
  ctx: ViewerAppContext,
  theme: string,
  source: object,
  generation: number,
): Promise<void> {
  try {
    if (
      themeRenderGenerations.get(ctx) !== generation ||
      ctx.state.theme !== theme ||
      ctx.state.currentTemplate !== source
    )
      return;
    await ctx.renderCurrentFrame({ forceFull: true });
  } finally {
    const snapshot = ctx.refs.themePreviewSnapshotCanvas;
    if (
      snapshot &&
      !snapshot.hidden &&
      themeRenderGenerations.get(ctx) === generation
    ) {
      await waitForThemePreviewPaint();
      if (themeRenderGenerations.get(ctx) === generation)
        snapshot.hidden = true;
    }
  }
}

function waitForThemePreviewPaint(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function preserveThemePreviewSnapshot(ctx: ViewerAppContext): boolean {
  const source = ctx.refs.canvas;
  const snapshot = ctx.refs.themePreviewSnapshotCanvas;
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
  ctx.applyTheme(getStoredTheme() ?? "dark", {
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

export function createThemeActions(
  getContext: () => ViewerAppContext,
): ThemeActions {
  return {
    applyTheme: bindViewerAction(applyTheme, getContext),
    toggleTheme: bindViewerAction(toggleTheme, getContext),
    initializeTheme: bindViewerAction(initializeTheme, getContext),
    syncThemeButton: bindViewerAction(syncThemeButton, getContext),
  };
}
