import type { Locale } from "../../shared/i18n/config.js";
import { cliMessages } from "../../shared/i18n/cli.js";
import { publicDiagnosticPath } from "./diagnostic-path.js";

export function sanitizeCliDiagnostics(
  result: Record<string, unknown>,
  locale: Locale,
): Record<string, unknown> {
  if (!Array.isArray(result.diagnostics)) return result;
  const diagnostics: unknown[] = result.diagnostics;
  const messages = cliMessages(locale);
  return {
    ...result,
    diagnostics: diagnostics.map((entry) => {
      const record = entry !== null && typeof entry === "object" ? entry : {};
      const code =
        "code" in record &&
        typeof record.code === "string" &&
        /^[A-Z][A-Z0-9_]{0,95}$/.test(record.code)
          ? record.code
          : "VALIDATION";
      const message =
        code === "JSON_INVALID"
          ? messages.invalidJson
          : code === "UNKNOWN_FIELD"
            ? messages.unknownField
            : code === "COMMAND_OP"
              ? messages.invalidCommand
              : code === "EXPRESSION_OP"
                ? messages.invalidExpression
                : messages.validationFailed;
      return {
        code,
        message,
        path: publicDiagnosticPath("path" in record ? record.path : undefined),
        severity:
          "severity" in record && record.severity === "warning"
            ? "warning"
            : "error",
        suggestion: messages.validationSuggestion,
      };
    }),
  };
}
