import type { DemoPackIssue } from "./common.js";
import { MAX_MODULE_BYTES } from "../protocol.js";
import { push } from "./common.js";

export async function readJson(
  url: string,
  errors: DemoPackIssue[],
  path: string,
): Promise<unknown> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      push(errors, path, `Missing file (${response.status}).`);
      return null;
    }
    return await response.json();
  } catch (error) {
    push(errors, path, error instanceof Error ? error.message : String(error));
    return null;
  }
}

export async function readText(
  url: string,
  errors: DemoPackIssue[],
  path: string,
): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      push(errors, path, `Missing file (${response.status}).`);
      return null;
    }
    const text = await response.text();
    if (new Blob([text]).size > MAX_MODULE_BYTES) {
      push(errors, path, `Module exceeds ${MAX_MODULE_BYTES} bytes.`);
      return null;
    }
    return text;
  } catch (error) {
    push(errors, path, error instanceof Error ? error.message : String(error));
    return null;
  }
}
