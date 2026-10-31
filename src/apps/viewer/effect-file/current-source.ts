import type { ViewerAppContext } from "../app/context.js";

export type CurrentEffectSourceContext = {
  deps: Pick<ViewerAppContext["deps"], "buildEffectFileSource">;
  getEffectiveTemplate: ViewerAppContext["getEffectiveTemplate"];
  state: Pick<
    ViewerAppContext["state"],
    "currentTemplate" | "modules" | "assets" | "controls"
  >;
};

export function buildCurrentEffectFile(
  ctx: CurrentEffectSourceContext,
): string {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  const module = template?.moduleId
    ? ctx.state.modules.get(template.moduleId)
    : undefined;
  return ctx.deps.buildEffectFileSource({
    assets: ctx.state.assets,
    controlValues: ctx.state.controls,
    module,
    template,
  });
}
