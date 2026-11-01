import { isAbsolute } from "node:path";

/** npm lifecycle commands expose their JavaScript entrypoint on every supported OS. */
export function resolveToolCommand(
  command: string,
  args: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
): { command: string; args: readonly string[] } {
  if (command !== "npm") return { command, args };
  const npmCli = environment.npm_execpath;
  if (!npmCli || !isAbsolute(npmCli) || !/\.[cm]?js$/iu.test(npmCli)) {
    throw new Error(
      "Run repository QA through npm run so npm_execpath identifies the npm JavaScript entrypoint.",
    );
  }
  return { command: process.execPath, args: [npmCli, ...args] };
}
