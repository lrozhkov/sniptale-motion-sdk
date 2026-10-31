export function bindViewerAction<Context, Args extends unknown[], Result>(
  action: (context: Context, ...args: Args) => Result,
  getContext: () => Context,
): (...args: Args) => Result {
  return (...args) => action(getContext(), ...args);
}
