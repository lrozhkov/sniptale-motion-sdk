import { bindViewerAction } from "../app/bind-action.js";
import type { EditorValidationActions } from "../validation/contract.js";
import type { ValidationIssueTarget } from "../validation/types.js";
import type { ViewerAppContext } from "../app/context.js";

function createValidationIssue(
  ctx: ViewerAppContext,
  message: string,
  target: ValidationIssueTarget = {},
) {
  return ctx.deps.createValidationIssueModel(message, target);
}
function categorizeValidationIssue(
  ctx: ViewerAppContext,
  issue: { message?: string; targetType?: string } | null | undefined,
) {
  return ctx.deps.categorizeValidationIssueModel(issue);
}
function toTitleLabel(value: string) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function createPanelValidationActions(
  getContext: () => ViewerAppContext,
): Pick<
  EditorValidationActions,
  "createValidationIssue" | "categorizeValidationIssue" | "toTitleLabel"
> {
  return {
    createValidationIssue: bindViewerAction(createValidationIssue, getContext),
    categorizeValidationIssue: bindViewerAction(
      categorizeValidationIssue,
      getContext,
    ),
    toTitleLabel,
  };
}
