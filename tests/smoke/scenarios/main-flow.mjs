import { assertCanvasTransformFlow } from "./canvas-transform.mjs";
import { assertCanvasMotionPathFlow } from "./canvas-motion-path.mjs";
import { assertGraphEditorFlow } from "./graph-editor.mjs";
import { assertEffectV1MainFlow } from "./effect-v1-main-flow.mjs";

export async function runSmokeScenarios(runtime) {
  await assertEffectV1MainFlow(runtime);
  await assertGraphEditorFlow(runtime);
  await assertCanvasMotionPathFlow(runtime);
  await assertCanvasTransformFlow(runtime);
}
