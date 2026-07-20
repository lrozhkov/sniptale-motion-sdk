import type { ViewerAppContext } from "../app/context.js";

function collectEditorValidationErrors(
  ctx: ViewerAppContext,
  template,
  knownAssetIds = ctx.state.assets,
  options: any = {},
) {
  return ctx.deps.collectEditorValidationErrorsModel(
    template,
    ctx.createEditorValidationOptions(knownAssetIds, {
      ...options,
      targetTemplate: template,
    }),
  );
}

function collectEditorValidationIssues(
  ctx: ViewerAppContext,
  template,
  knownAssetIds = ctx.state.assets,
  options: any = {},
) {
  return ctx.deps.collectEditorValidationIssuesModel(
    template,
    ctx.createEditorValidationOptions(knownAssetIds, {
      ...options,
      targetTemplate: template,
    }),
  );
}

function createEditorValidationOptions(
  ctx: ViewerAppContext,
  knownAssetIds = ctx.state.assets,
  options: any = {},
) {
  return {
    ...options,
    assets: ctx.state.assets,
    isSafeLocalAssetPath: ctx.deps.isSafeLocalAssetPath,
    isSafeSvgAssetText: ctx.deps.isSafeSvgAssetText,
    knownAssetIds,
    rendererCoverage: Object.hasOwn(options, "rendererCoverage")
      ? options.rendererCoverage
      : options.targetTemplate?.id === ctx.state.currentTemplate?.id &&
          !isRendererContractCoveragePending(ctx, options.targetTemplate) &&
          ctx.state.rendererContractTemplateId === ctx.state.currentTemplate?.id
        ? ctx.state.rendererContractReads
        : null,
  };
}

export function isRendererContractCoveragePending(
  ctx: ViewerAppContext,
  template = ctx.state.currentTemplate,
): boolean {
  return Boolean(
    template &&
    !ctx.state.rendererContractCoverageLockedForTest &&
    (ctx.state.rendererContractTemplateId !== template.id ||
      !ctx.state.rendererContractCoverageReady),
  );
}

export function installEditorValidationOwner(ctx: ViewerAppContext): void {
  ctx.collectEditorValidationErrors = (...args: any[]) =>
    (collectEditorValidationErrors as any)(ctx, ...args);
  ctx.collectEditorValidationIssues = (...args: any[]) =>
    (collectEditorValidationIssues as any)(ctx, ...args);
  ctx.createEditorValidationOptions = (...args: any[]) =>
    (createEditorValidationOptions as any)(ctx, ...args);
  ctx.isRendererContractCoveragePending = (...args: any[]) =>
    (isRendererContractCoveragePending as any)(ctx, ...args);
}
