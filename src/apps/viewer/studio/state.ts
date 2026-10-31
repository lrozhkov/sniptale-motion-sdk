import type {
  StudioEffectSelection,
  StudioRevision,
} from "../../../shared/studio/revision-contract.js";
export function createViewerStudioState(): {
  studio: {
    sources: Map<string, StudioEffectSelection>;
    saved: Map<string, StudioRevision>;
    busy: boolean;
    ready: boolean;
    discoveryFailures: Map<string, string>;
  };
} {
  return {
    studio: {
      sources: new Map(),
      saved: new Map(),
      busy: false,
      ready: false,
      discoveryFailures: new Map(),
    },
  };
}
