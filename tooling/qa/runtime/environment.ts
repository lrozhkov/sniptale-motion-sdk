import { delimiter, resolve } from "node:path";

export function initializeQaEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
  root = process.cwd(),
): void {
  environment.PATH = [
    ...new Set([
      resolve(root, ".tmp/ci/bin"),
      ...(environment.PATH?.split(delimiter) ?? []),
    ]),
  ].join(delimiter);
  environment.PLAYWRIGHT_BROWSERS_PATH ??= resolve(root, ".tmp/playwright");
  environment.MOTION_NPM_BROWSER_ACCEPT = "1";
}
