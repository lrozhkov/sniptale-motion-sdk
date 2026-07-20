export function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isSafeLocalPath(path) {
  if (typeof path !== "string" || path.trim() === "") {
    return false;
  }
  if (/^[a-z]+:/i.test(path) || path.startsWith("/") || path.includes("..")) {
    return false;
  }
  return !path.includes("\\");
}

export function push(errors, path, message) {
  errors.push({ path, message });
}
