import type {
  LocalEffectCatalog,
  LocalEffectSource,
} from "../../../shared/studio/protocol.js";
import type { StudioEffectSelection } from "../../../shared/studio/revision-contract.js";

export type StudioSource = LocalEffectSource & {
  studio: StudioEffectSelection;
};
export type ReloadTarget = {
  identity: object;
  effectId: string;
  selection: StudioEffectSelection;
  editor(): { fingerprint: string; dirty: boolean };
  blocked(): boolean;
};
export type ReloadNotice =
  | "current"
  | "updated"
  | "pending"
  | "unavailable"
  | "failed";
export function sourceVersion(source: StudioSource): string {
  return `${source.studio.revisionId ?? "source"}:${source.studio.fingerprint}`;
}

export function createStudioReloadCoordinator<Prepared>(ports: {
  target(): ReloadTarget | null;
  prepare(source: StudioSource, target: ReloadTarget): Promise<Prepared>;
  apply(
    prepared: Prepared,
    source: StudioSource,
    target: ReloadTarget,
    canCommit: () => boolean,
  ): Promise<boolean>;
  notice(state: ReloadNotice): void;
}) {
  const sources = new Map<string, StudioSource>();
  let usable = false;
  let closed = false;
  let running: Promise<void> | null = null;
  let failedVersion: string | null = null;
  let permit: { identity: object; fingerprint: string } | null = null;
  let rerun = false;
  const sameTarget = (target: ReloadTarget) =>
    ports.target()?.identity === target.identity;
  const execute = async () => {
    const target = ports.target();
    if (!target) {
      ports.notice("current");
      return;
    }
    if (closed || !usable || target.blocked()) return;
    const source = sources.get(target.effectId);
    if (!source) {
      ports.notice("unavailable");
      return;
    }
    const version = sourceVersion(source);
    if (
      version ===
      `${target.selection.revisionId ?? "source"}:${target.selection.fingerprint}`
    ) {
      ports.notice("current");
      return;
    }
    if (failedVersion === version) {
      ports.notice("failed");
      return;
    }
    const editor = target.editor();
    const permitted =
      permit?.identity === target.identity &&
      permit.fingerprint === editor.fingerprint;
    if (
      (editor.dirty ||
        source.studio.revisionId !== target.selection.revisionId) &&
      !permitted
    ) {
      ports.notice("pending");
      return;
    }
    const canCommit = () =>
      !closed &&
      usable &&
      sameTarget(target) &&
      !target.blocked() &&
      sources.get(target.effectId) === source &&
      target.editor().fingerprint === editor.fingerprint;
    try {
      const prepared = await ports.prepare(source, target);
      if (!canCommit()) return;
      if (await ports.apply(prepared, source, target, canCommit)) {
        permit = null;
        ports.notice("updated");
      }
    } catch {
      if (canCommit()) {
        failedVersion = version;
        ports.notice("failed");
      }
    }
  };
  const sync = (): Promise<void> => {
    if (closed) return Promise.resolve();
    if (running) {
      rerun = true;
      return running;
    }
    rerun = false;
    running = execute()
      .catch(() => {
        if (!closed) ports.notice("failed");
      })
      .finally(() => {
        running = null;
        if (rerun && !closed) void sync();
      });
    return running;
  };
  return {
    accept(catalog: LocalEffectCatalog): Promise<void> {
      const next = new Map<string, StudioSource>();
      for (const source of catalog.effects) {
        if (!source.studio) continue;
        const entry = { ...source, studio: source.studio };
        const old = sources.get(entry.studio.effectId);
        next.set(
          entry.studio.effectId,
          old && sourceVersion(old) === sourceVersion(entry) ? old : entry,
        );
      }
      sources.clear();
      for (const [id, source] of next) sources.set(id, source);
      usable = true;
      return sync();
    },
    unavailable() {
      usable = false;
      ports.notice("unavailable");
    },
    sync,
    source(id: string) {
      return usable ? sources.get(id) : undefined;
    },
    entries() {
      return usable ? [...sources.values()] : [];
    },
    get applying() {
      return running !== null;
    },
    permitCurrent() {
      const target = ports.target();
      if (target)
        permit = {
          identity: target.identity,
          fingerprint: target.editor().fingerprint,
        };
      failedVersion = null;
      return sync();
    },
    close() {
      closed = true;
      sources.clear();
      permit = null;
    },
  };
}
