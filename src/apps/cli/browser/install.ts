import { runBrowserInstaller } from "./installer-process.js";
import { join } from "node:path";
import type { CliContext } from "../context.js";
import { MotionCliError } from "../errors.js";
import { cliMessages } from "../../../shared/i18n/cli.js";
import type { Locale } from "../../../shared/i18n/config.js";

export async function installMotionBrowser(
  context: CliContext,
  locale: Locale,
): Promise<void> {
  context.signal?.throwIfAborted();
  const messages = cliMessages(locale);
  context.stderr(`${messages.browserInstalling}\n`);
  if (
    !(await runBrowserInstaller(
      join(context.packageRoot, "node_modules/playwright-core/cli.js"),
      context.signal,
    ))
  )
    throw new MotionCliError("BROWSER_INSTALL", messages.browserInstallFailed);
}
