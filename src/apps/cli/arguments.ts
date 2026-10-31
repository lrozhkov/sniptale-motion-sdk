import { parseArgs } from "node:util";
import type { Locale } from "../../shared/i18n/config.js";
import { MotionCliError } from "./errors.js";

export function parseCliArguments(argv: string[]) {
  const command = argv[0]?.startsWith("-") ? "help" : (argv[0] ?? "help");
  const options = {
    help: { type: "boolean", short: "h" },
    json: { type: "boolean" },
    locale: { type: "string" },
    version: { type: "boolean" },
    ...(command === "studio"
      ? { "no-open": { type: "boolean" as const } }
      : {}),
    ...(command === "new" ? { kind: { type: "string" as const } } : {}),
    ...(command === "validate" || command === "export"
      ? { "asset-root": { type: "string" as const } }
      : {}),
    ...(command === "export" ? { output: { type: "string" as const } } : {}),
  } as const;
  let parsed;
  try {
    parsed = parseArgs({
      args: command === "help" && argv[0] !== "help" ? argv : argv.slice(1),
      options,
      allowPositionals: true,
      strict: true,
      tokens: true,
    });
  } catch (error) {
    throw new MotionCliError(
      "ARGUMENTS",
      error instanceof Error ? error.message : String(error),
    );
  }
  const seen = new Set<string>();
  for (const token of parsed.tokens) {
    if (token.kind !== "option") continue;
    if (seen.has(token.name))
      throw new MotionCliError("ARGUMENTS", `Repeated option: --${token.name}`);
    seen.add(token.name);
  }
  const locale = parseLocale(parsed.values.locale);
  if (
    ![
      "help",
      "init",
      "new",
      "validate",
      "export",
      "doctor",
      "docs",
      "studio",
    ].includes(command)
  ) {
    throw new MotionCliError("ARGUMENTS", `Unknown command: ${command}`);
  }
  const minimum = ["new", "validate", "export"].includes(command) ? 1 : 0;
  const maximum = ["init", "new", "validate", "export", "studio"].includes(
    command,
  )
    ? 1
    : 0;
  if (
    !parsed.values.help &&
    !parsed.values.version &&
    (parsed.positionals.length < minimum || parsed.positionals.length > maximum)
  ) {
    throw new MotionCliError(
      "ARGUMENTS",
      `Unexpected arguments for ${command}; use ${command} --help.`,
    );
  }
  return {
    command,
    values: {
      "no-open": parsed.values["no-open"] === true,
      help: parsed.values.help === true,
      json: parsed.values.json === true,
      version: parsed.values.version === true,
      kind:
        typeof parsed.values.kind === "string" ? parsed.values.kind : undefined,
      output:
        typeof parsed.values.output === "string"
          ? parsed.values.output
          : undefined,
      "asset-root":
        typeof parsed.values["asset-root"] === "string"
          ? parsed.values["asset-root"]
          : undefined,
    },
    positional: parsed.positionals[0],
    locale,
  };
}

function parseLocale(value: unknown): Locale {
  if (value === undefined) return "ru";
  if (value === "ru" || value === "en") return value;
  throw new MotionCliError("ARGUMENTS", "--locale must be ru or en.");
}
