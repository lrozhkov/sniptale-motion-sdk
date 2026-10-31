export type JsonFilePickerOptions = {
  multiple: boolean;
  types: readonly {
    accept: Readonly<Record<string, readonly string[]>>;
    description: string;
  }[];
};

export function readPickedJsonHandle(value: unknown): FileSystemFileHandle {
  const entries: unknown[] = Array.isArray(value) ? value : [];
  const handle = entries.length === 1 ? entries[0] : undefined;
  if (
    typeof FileSystemFileHandle === "undefined" ||
    !(handle instanceof FileSystemFileHandle) ||
    handle.kind !== "file"
  )
    throw new Error("Invalid file picker result.");
  return handle;
}

export function readWritableFile(value: unknown): FileSystemWritableFileStream {
  if (
    typeof FileSystemWritableFileStream === "undefined" ||
    !(value instanceof FileSystemWritableFileStream)
  )
    throw new Error("Invalid writable file stream.");
  return value;
}
