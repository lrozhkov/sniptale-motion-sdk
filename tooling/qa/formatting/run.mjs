import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadFormattingOptions } from "./options.mjs";

const arguments_ = process.argv.slice(2);
if (arguments_.includes("--help")) {
  process.stdout.write(
    "Usage: npm run format [-- --write]\nChecks repository formatting. --write applies formatting to the canonical scope.\n",
  );
} else if (
  arguments_.length > 1 ||
  arguments_.some((argument) => argument !== "--write")
) {
  process.stderr.write(
    "Expected only --write, or no arguments for a formatting check.\n",
  );
  process.exitCode = 2;
} else {
  loadFormattingOptions();
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(
        new URL("../../../node_modules/oxfmt/bin/oxfmt", import.meta.url),
      ),
      "--config",
      ".oxfmtrc.json",
      "--ignore-path",
      ".oxfmtignore",
      "--disable-nested-config",
      arguments_.includes("--write") ? "--write" : "--check",
      ".",
    ],
    { cwd: root, stdio: "inherit" },
  );
  if (result.error) process.stderr.write(`${result.error.message}\n`);
  process.exitCode = result.status ?? 1;
}
