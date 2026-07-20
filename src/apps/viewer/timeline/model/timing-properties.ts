import type { ViewerAppContext } from "../../app/context.js";

function updatePhaseProperty(ctx: ViewerAppContext, phaseId, property, value) {
  const template = ctx.state.currentTemplate;
  const timeline = ctx.getEffectiveTimeline(template);
  const phase = timeline.phases.find((item) => item.id === phaseId);
  if (!template || !phase || phase.locked) {
    return;
  }
  const duration = ctx.getEffectiveDuration(template);
  ctx.beginEditorCommand({
    payload: { phaseId, property, value },
    type: "movePhase",
  });
  if (property === "label") {
    phase.label = String(value || phase.id);
  } else if (property === "start") {
    const nextStart = ctx.snapTime(
      ctx.deps.clamp(
        Number(value) || 0,
        0,
        Math.max(0, duration - phase.duration),
      ),
    );
    const plan = ctx.createPhaseMovePlan(
      ctx.getEffectiveTemplate(template),
      [phaseId],
      duration,
    );
    ctx.applyPhaseMovePlan(
      template,
      plan,
      ctx.deps.clamp(nextStart - phase.start, plan.minDelta, plan.maxDelta),
    );
    ctx.selectPhaseBlock(phaseId);
    return;
  } else if (property === "duration") {
    phase.duration = ctx.snapDuration(
      ctx.deps.clamp(
        Number(value) || 0.05,
        0.05,
        Math.max(0.05, duration - phase.start),
      ),
    );
  }
  ctx.state.timelineOverrides.set(
    template.id,
    ctx.deps.normalizeTimeline(timeline, duration),
  );
  ctx.selectPhaseBlock(phaseId);
  ctx.renderTimelineEditor(template);
  void ctx.renderCurrentFrame();
}

function updateSceneProperty(ctx: ViewerAppContext, sceneId, property, value) {
  const template = ctx.state.currentTemplate;
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  if (!template || !effectiveTemplate) {
    return;
  }
  const duration = ctx.getEffectiveDuration(template);
  const scenes = ctx.normalizeScenes(effectiveTemplate.scenes ?? [], duration);
  const scene = scenes.find((item) => item.id === sceneId);
  if (!scene || scene.locked) {
    return;
  }
  ctx.beginEditorCommand({
    payload: { property, sceneId, value },
    type: "moveScene",
  });
  if (property === "label") {
    scene.label = String(value || scene.id);
  } else if (property === "start") {
    const nextStart = ctx.snapTime(
      ctx.deps.clamp(
        Number(value) || 0,
        0,
        Math.max(0, duration - scene.duration),
      ),
    );
    const plan = ctx.createSceneMovePlan(
      effectiveTemplate,
      [sceneId],
      duration,
    );
    ctx.applySceneMovePlan(
      template,
      plan,
      ctx.deps.clamp(nextStart - scene.start, plan.minDelta, plan.maxDelta),
    );
    ctx.selectSceneBlock(sceneId);
    return;
  } else if (property === "duration") {
    scene.duration = ctx.snapDuration(
      ctx.deps.clamp(
        Number(value) || 0.05,
        0.05,
        Math.max(0.05, duration - scene.start),
      ),
    );
  }
  ctx.setEditorOverride({ scenes });
  ctx.selectSceneBlock(sceneId);
  ctx.renderTimelineEditor(template);
  void ctx.renderCurrentFrame();
}

export function installTimelineTimingPropertiesOwner(
  ctx: ViewerAppContext,
): void {
  ctx.updatePhaseProperty = (...args: any[]) =>
    (updatePhaseProperty as any)(ctx, ...args);
  ctx.updateSceneProperty = (...args: any[]) =>
    (updateSceneProperty as any)(ctx, ...args);
}
