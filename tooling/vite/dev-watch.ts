export const DEV_SERVER_WATCH_IGNORED = ["**/.tmp/**", "**/dist/**"] as const;

export function createDevServerWatchOptions() {
  return {
    ignored: [...DEV_SERVER_WATCH_IGNORED],
  };
}
