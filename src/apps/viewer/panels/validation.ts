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
  ctx.createValidationIssue = (...args: any[]) =>
    (createValidationIssue as any)(ctx, ...args);
  ctx.categorizeValidationIssue = (...args: any[]) =>
    (categorizeValidationIssue as any)(ctx, ...args);
  ctx.toTitleLabel = (...args: any[]) => (toTitleLabel as any)(ctx, ...args);
}
