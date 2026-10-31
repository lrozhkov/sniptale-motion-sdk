const LOOPBACK_HOSTS = new Set(["127.0.0.1", "[::1]", "localhost"]);

export function isLoopbackHostHeader(value: unknown): boolean {
  if (typeof value !== "string" || value.length === 0 || value.length > 255) {
    return false;
  }
  try {
    const url = new URL(`http://${value}`);
    return (
      LOOPBACK_HOSTS.has(url.hostname.toLowerCase()) &&
      url.username === "" &&
      url.password === "" &&
      (url.port === "" || /^\d{1,5}$/.test(url.port))
    );
  } catch {
    return false;
  }
}
