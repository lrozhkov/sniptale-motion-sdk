import type { ViewerAppContext } from "./context.js";

function setPackStatus(ctx: ViewerAppContext, text, variant) {
  ctx.refs.packStatus.textContent = text;
  ctx.refs.packStatus.title = text;
  ctx.refs.packStatus.className = `status-chip ${variant}`;
}
function logDiagnostic(ctx: ViewerAppContext, message, level = "info") {
  const row = document.createElement("div");
  row.className = `diagnostic ${level}`;
  row.textContent = `${new Date().toLocaleTimeString()} · ${message}`;
  ctx.refs.diagnostics.append(row);
  if (ctx.refs.copyDiagnosticsButton) {
    ctx.refs.copyDiagnosticsButton.disabled = false;
  }
  ctx.syncHealthState();
}

async function copyDiagnostics(ctx: ViewerAppContext): Promise<boolean> {
  const text = formatDiagnosticsText(ctx.refs.diagnostics?.children ?? []);
  if (!text) {
    showCopyDiagnosticsState(
      ctx,
      ctx.deps.t("viewer.health.diagnosticsEmpty", "Log is empty"),
    );
    return false;
  }
  if (await writeTextToClipboard(text)) {
    showCopyDiagnosticsState(
      ctx,
      ctx.deps.t("viewer.health.diagnosticsCopied", "Log copied"),
    );
    return true;
  }
  const message = ctx.deps.t(
    "viewer.health.diagnosticsCopyFailed",
    "Could not copy the log",
  );
  showCopyDiagnosticsState(ctx, message);
  ctx.logDiagnostic(message, "error");
  return false;
}

export function formatDiagnosticsText(
  rows: Iterable<{ textContent?: string | null }>,
): string {
  return Array.from(rows)
    .map((row) => row.textContent?.trim() ?? "")
    .filter(Boolean)
    .join("\n");
}

async function writeTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  return copyTextWithTextArea(text);
}

function copyTextWithTextArea(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.position = "fixed";
  textarea.style.inset = "-10000px auto auto -10000px";
  document.body.append(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {}
  textarea.remove();
  return copied;
}

function showCopyDiagnosticsState(ctx: ViewerAppContext, label: string): void {
  const button = ctx.refs.copyDiagnosticsButton;
  if (!button) {
    return;
  }
  window.clearTimeout(ctx.diagnosticsCopyResetTimer);
  ctx.setIconButton(button, "copy", label, { showText: true });
  ctx.diagnosticsCopyResetTimer = window.setTimeout(() => {
    ctx.setIconButton(
      button,
      "copy",
      ctx.deps.t("viewer.health.copyDiagnostics", "Copy log"),
      { showText: true },
    );
  }, 1600);
}

export function installAppDiagnosticsOwner(ctx: ViewerAppContext): void {
  ctx.setPackStatus = (...args: any[]) => (setPackStatus as any)(ctx, ...args);
  ctx.logDiagnostic = (...args: any[]) => (logDiagnostic as any)(ctx, ...args);
  ctx.copyDiagnostics = (...args: any[]) =>
    (copyDiagnostics as any)(ctx, ...args);
}
