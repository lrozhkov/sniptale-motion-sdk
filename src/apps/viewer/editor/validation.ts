import { bindViewerAction } from "../app/bind-action.js";
import { isValidationRecord } from "../validation/input.js";
import type {
  EditorValidationActions,
  EditorValidationContextOptions,
} from "../validation/contract.js";
import type {
  KnownValidationAssets,
  EditorValidationOptions,
} from "../validation/types.js";
import type { EditorTimelineSource } from "./timeline-source.js";
import type { ViewerAppContext } from "../app/context.js";

function collectEditorValidationErrors(
  ctx: ViewerAppContext,
  template: unknown,
  knownAssetIds: KnownValidationAssets = ctx.state.assets,
  options: EditorValidationOptions = {},
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
  template: unknown,
  knownAssetIds: KnownValidationAssets = ctx.state.assets,
  options: EditorValidationOptions = {},
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
  knownAssetIds: KnownValidationAssets = ctx.state.assets,
  options: EditorValidationContextOptions = {},
) {
  return {
    ...options,
    assets: ctx.state.assets,
    isSafeLocalAssetPath: ctx.deps.isSafeLocalAssetPath,
    isSafeSvgAssetText: ctx.deps.isSafeSvgAssetText,
    knownAssetIds,
    rendererCoverage: Object.hasOwn(options, "rendererCoverage")
      ? options.rendererCoverage
      : isValidationRecord(options.targetTemplate) &&
          options.targetTemplate.id === ctx.state.currentTemplate?.id &&
          !isRendererContractCoveragePending(ctx) &&
          ctx.state.rendererContractTemplateId === ctx.state.currentTemplate?.id
        ? ctx.state.rendererContractReads
        : null,
  };
}

export function isRendererContractCoveragePending(
  ctx: ViewerAppContext,
  template: EditorTimelineSource | null = ctx.state.currentTemplate,
): boolean {
  return Boolean(
    template &&
    !ctx.state.rendererContractCoverageLockedForTest &&
    (ctx.state.rendererContractTemplateId !== template.id ||
      !ctx.state.rendererContractCoverageReady),
  );
}

export function createEditorValidationActions(
  getContext: () => ViewerAppContext,
): Pick<
  EditorValidationActions,
  | "collectEditorValidationErrors"
  | "collectEditorValidationIssues"
  | "createEditorValidationOptions"
  | "isRendererContractCoveragePending"
> {
  return {
    collectEditorValidationErrors: bindViewerAction(
      collectEditorValidationErrors,
      getContext,
    ),
    collectEditorValidationIssues: bindViewerAction(
      collectEditorValidationIssues,
      getContext,
    ),
    createEditorValidationOptions: bindViewerAction(
      createEditorValidationOptions,
      getContext,
    ),
    isRendererContractCoveragePending: bindViewerAction(
      isRendererContractCoveragePending,
      getContext,
    ),
  };
}
