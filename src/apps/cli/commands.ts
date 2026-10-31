import type { CliContext } from "./context.js";
import { runStudioCommand } from "./studio/command.js";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  parseEffectV1Source,
  EFFECT_V1_KINDS,
} from "../../sdk/effect-v1/index.js";
import { cliMessages } from "../../shared/i18n/cli.js";
import {
  readMaterializedEffectV1Bundle,
  EffectV1BundleError,
} from "./bundle-source.js";
import { parseCliArguments } from "./arguments.js";
import { MotionCliError } from "./errors.js";
import { initProject, newEffect } from "./project.js";
import { exportMotionEffect } from "./export.js";
import { inspectMotionBrowser } from "./browser/runtime.js";
import { installMotionBrowser } from "./browser/install.js";
import { proveMotionEffect } from "./proof/command.js";
import { sanitizeCliDiagnostics } from "./diagnostics.js";
import { publicDiagnosticPath } from "./diagnostic-path.js";
import type { Locale } from "../../shared/i18n/config.js";

export async function runMotionCli(
  argv: string[],
  context: CliContext,
): Promise<number> {
  let locale: Locale = "ru";
  try {
    const args = parseCliArguments(argv);
    locale = args.locale;
    const messages = cliMessages(args.locale);
    if (args.values.version) {
      context.stdout(
        args.values.json
          ? `${JSON.stringify({ ok: true, version: context.version })}\n`
          : `${context.version}\n`,
      );
      return 0;
    }
    if (args.command === "help" || args.values.help) {
      const text = `sniptale-motion ${context.version}\n\n${messages.help}`;
      context.stdout(
        args.values.json
          ? `${JSON.stringify({ ok: true, help: text })}\n`
          : text,
      );
      return 0;
    }
    let result: Record<string, unknown>;
    if (args.command === "init") {
      result = {
        ok: true,
        ...(await initProject(
          context.cwd,
          args.positional ?? ".",
          context.version,
        )),
      };
    } else if (args.command === "new") {
      const kind = EFFECT_V1_KINDS.find(
        (candidate) => candidate === (args.values.kind ?? "standalone"),
      );
      if (!kind)
        throw new MotionCliError(
          "ARGUMENTS",
          `--kind must be ${EFFECT_V1_KINDS.join(", ")}.`,
        );
      if (!args.positional)
        throw new MotionCliError("ARGUMENTS", "new requires an id.");
      result = {
        ok: true,
        ...(await newEffect(context.cwd, args.positional, kind)),
      };
    } else if (args.command === "validate") {
      if (!args.positional)
        throw new MotionCliError("ARGUMENTS", "validate requires a file.");
      const file = resolve(context.cwd, args.positional);
      const source = await readMaterializedEffectV1Bundle(
        file,
        args.values["asset-root"]
          ? resolve(context.cwd, args.values["asset-root"])
          : undefined,
      );
      const { document: _document, ...validation } =
        parseEffectV1Source(source);
      result = {
        ...validation,
        file,
        proof: {
          schema: validation.ok ? "passed" : "failed",
          runtime: "not-run",
        },
      };
    } else if (args.command === "prove") {
      if (!args.positional)
        throw new MotionCliError("ARGUMENTS", "prove requires a file.");
      result = await proveMotionEffect(
        context,
        resolve(context.cwd, args.positional),
        {
          locale: args.locale,
          ...(context.signal ? { signal: context.signal } : {}),
          ...(args.values.browserChannel
            ? { channel: args.values.browserChannel }
            : {}),
          ...(args.values["asset-root"]
            ? { assetRoot: resolve(context.cwd, args.values["asset-root"]) }
            : {}),
        },
      );
    } else if (args.command === "export") {
      if (!args.positional || !args.values.output)
        throw new MotionCliError(
          "ARGUMENTS",
          "export requires a file and --output <file>.",
        );
      result = await exportMotionEffect(
        resolve(context.cwd, args.positional),
        resolve(context.cwd, args.values.output),
        {
          ...(args.values["asset-root"]
            ? { assetRoot: resolve(context.cwd, args.values["asset-root"]) }
            : {}),
          ...(context.signal ? { signal: context.signal } : {}),
        },
      );
    } else if (args.command === "studio") {
      await runStudioCommand(
        context,
        args.positional ?? ".",
        { json: args.values.json, noOpen: args.values["no-open"] },
        messages,
      );
      return 0;
    } else if (args.command === "browser") {
      if (args.positional !== "install")
        throw new MotionCliError(
          "ARGUMENTS",
          "Use browser install to install separate Chromium.",
        );
      await installMotionBrowser(context, args.locale);
      result = { ok: true, browser: "chromium", installation: "completed" };
    } else if (args.command === "docs") {
      const text = await readFile(
        join(context.packageRoot, "README.md"),
        "utf8",
      );
      context.stdout(
        args.values.json ? `${JSON.stringify({ ok: true, text })}\n` : text,
      );
      return 0;
    } else {
      result = {
        ok: true,
        version: context.version,
        node: process.version,
        platform: process.platform,
        architecture: process.arch,
        browser: await inspectMotionBrowser({
          locale: args.locale,
          ...(context.signal ? { signal: context.signal } : {}),
          ...(args.values.browserChannel
            ? { channel: args.values.browserChannel }
            : {}),
        }),
      };
    }
    result = sanitizeCliDiagnostics(result, args.locale);
    if (args.values.json) context.stdout(`${JSON.stringify(result)}\n`);
    else {
      const stream = result.ok ? context.stdout : context.stderr;
      stream(
        `${result.ok ? messages.success : messages.failure}\n${JSON.stringify(result, null, 2)}\n`,
      );
    }
    return result.ok ? 0 : 1;
  } catch (error) {
    const code =
      error instanceof MotionCliError || error instanceof EffectV1BundleError
        ? error.code
        : filesystemCode(error);
    const messages = cliMessages(locale);
    const message =
      error instanceof EffectV1BundleError
        ? messages.assetValidationFailed
        : error instanceof MotionCliError
          ? error.message
          : messages.operationFailed;
    if (argv.includes("--json"))
      context.stdout(
        `${JSON.stringify({ ok: false, diagnostics: [{ code, message, path: error instanceof EffectV1BundleError ? publicDiagnosticPath(error.path) : "$", severity: "error" }] })}\n`,
      );
    else context.stderr(`${code}: ${message}\n`);
    return code === "ARGUMENTS" ? 2 : 1;
  }
}

function filesystemCode(error: unknown): string {
  return error !== null &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : "OPERATION_FAILED";
}
