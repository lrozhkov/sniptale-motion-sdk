import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { startMotionStudio } from "./server.js";
import type { CliContext } from "../context.js";
import type { cliMessages } from "../../../shared/i18n/cli.js";

export async function runStudioCommand(
  context: CliContext,
  directory: string,
  options: { json: boolean; noOpen: boolean },
  messages: ReturnType<typeof cliMessages>,
): Promise<void> {
  const studio = await startMotionStudio(
    resolve(context.cwd, directory),
    context.packageRoot,
  );
  try {
    if (context.signal?.aborted) return;
    context.stdout(
      options.json
        ? `${JSON.stringify({ ok: true, command: "studio", status: "ready", project: studio.project, url: studio.url, viewerOrigin: studio.viewerOrigin, sandboxOrigin: studio.sandboxOrigin })}\n`
        : `${messages.studioReady}\n${studio.url}\n${messages.studioStop}\n`,
    );
    if (!options.noOpen) {
      try {
        await openStudioBrowser(studio.url);
      } catch {
        context.stderr(`${messages.browserOpenFailed}\n`);
      }
    }
    if (!context.signal?.aborted)
      await new Promise<void>((resolve) =>
        context.signal?.addEventListener("abort", () => resolve(), {
          once: true,
        }),
      );
  } finally {
    await studio.close();
  }
}

export function openStudioBrowser(url: string): Promise<void> {
  const [command, args] =
    process.platform === "win32"
      ? (["rundll32.exe", ["url.dll,FileProtocolHandler", url]] as const)
      : process.platform === "darwin"
        ? (["open", [url]] as const)
        : (["xdg-open", [url]] as const);
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      stdio: "ignore",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}
