import type { ViewerAppContext } from "../app/context.js";
import type { InspectorOwnershipActions } from "./ownership-contract.js";
import { createOwnershipSummaryActions } from "./ownership-summary.js";
import { createOwnershipUpdateActions } from "./ownership-updates.js";
import { createOwnershipEditorActions } from "./ownership-editors.js";
import { createOwnershipSelectActions } from "./ownership-select.js";

export function createInspectorOwnershipActions(
  getContext: () => ViewerAppContext,
): InspectorOwnershipActions {
  return {
    ...createOwnershipSummaryActions(getContext),
    ...createOwnershipUpdateActions(getContext),
    ...createOwnershipEditorActions(getContext),
    ...createOwnershipSelectActions(getContext),
  };
}
