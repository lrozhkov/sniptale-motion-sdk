import type { ViewerAppContext } from "../app/context.js";

function createValidationIssue(
  ctx: ViewerAppContext,
  message,
  target: any = {},
) {
  return ctx.deps.createValidationIssueModel(message, target);
}
function categorizeValidationIssue(ctx: ViewerAppContext, issue) {
  return ctx.deps.categorizeValidationIssueModel(issue);
}
function toTitleLabel(ctx: ViewerAppContext, value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function installPanelsValidationOwner(ctx: ViewerAppContext): void {
  ctx.createValidationIssue = createValidationIssue.bind(undefined, ctx);
  ctx.categorizeValidationIssue = categorizeValidationIssue.bind(
    undefined,
    ctx,
  );
  ctx.toTitleLabel = toTitleLabel.bind(undefined, ctx);
}
