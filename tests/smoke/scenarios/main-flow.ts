import { assertPreviewControlsLayout } from "./preview-controls.ts";
import type { SmokeRuntime } from "../../../tooling/test/smoke/runtime.ts";
import { assertInspectorSvgFlow } from "./inspector-svg.ts";
import { assertCanvasTransformFlow } from "./canvas-transform.ts";
import { assertCanvasMotionPathFlow } from "./canvas-motion-path.ts";
import { assertGraphEditorFlow } from "./graph-editor.ts";
import { assertEffectV1MainFlow } from "./effect-v1-main-flow.ts";

export async function runSmokeScenarios(runtime: SmokeRuntime) {
  await assertEffectV1MainFlow(runtime);
  await assertPreviewControlsLayout(runtime);
  await assertGraphEditorFlow(runtime);
  await assertCanvasMotionPathFlow(runtime);
  await assertCanvasTransformFlow(runtime);
  await assertInspectorSvgFlow(runtime);
}
