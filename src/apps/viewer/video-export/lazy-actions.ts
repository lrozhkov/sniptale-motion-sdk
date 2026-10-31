import type { Mp4ExportActions } from "./actions.js";

export function createLazyMp4ExportActions(
  load: () => Promise<Mp4ExportActions>,
  reportFailure: (error: unknown) => void,
  getSelection: () => unknown,
): Mp4ExportActions {
  let runtime: Mp4ExportActions | null = null;
  let loading: Promise<Mp4ExportActions> | null = null;
  let intent = 0;
  const ensureRuntime = (): Promise<Mp4ExportActions> => {
    if (runtime) return Promise.resolve(runtime);
    loading ??= Promise.resolve()
      .then(load)
      .then((actions) => {
        runtime = actions;
        return actions;
      })
      .catch((error: unknown) => {
        loading = null;
        throw error;
      });
    return loading;
  };
  const invoke = async (
    action: (actions: Mp4ExportActions) => Promise<void>,
    generation = intent,
  ): Promise<void> => {
    const selection = getSelection();
    try {
      const actions = await ensureRuntime();
      if (generation !== intent || selection !== getSelection()) return;
      await action(actions);
    } catch (error) {
      if (generation === intent && selection === getSelection())
        reportFailure(error);
    }
  };
  return {
    localizeMp4ExportDialog() {
      runtime?.localizeMp4ExportDialog();
    },
    openMp4ExportDialog() {
      return invoke((actions) => actions.openMp4ExportDialog(), ++intent);
    },
    closeMp4ExportDialog() {
      intent += 1;
      runtime?.closeMp4ExportDialog();
    },
    updateMp4ExportSize() {
      return invoke((actions) => actions.updateMp4ExportSize());
    },
    updateMp4ExportCustomSize() {
      return invoke((actions) => actions.updateMp4ExportCustomSize());
    },
    startMp4Export(event) {
      event?.preventDefault();
      return invoke((actions) => actions.startMp4Export());
    },
  };
}
