import {
  parseDomMotionDocument,
  type DomMotionDocument,
} from "../../../sdk/dom-motion/index.js";
export const LOCAL_DOM_MOTION_ROUTE = "/__sniptale/dom-motion";

export async function loadLocalDomMotionCatalog(
  fetcher: typeof fetch = fetch,
): Promise<DomMotionDocument[]> {
  const response = await fetcher(LOCAL_DOM_MOTION_ROUTE, { cache: "no-store" });
  if (response.status === 404) return [];
  if (!response.ok)
    throw new Error(`DOM motion catalog HTTP ${response.status}`);
  const value: unknown = await response.json();
  if (
    !value ||
    typeof value !== "object" ||
    !("documents" in value) ||
    !Array.isArray(value.documents) ||
    value.documents.length > 16
  )
    throw new Error("Invalid DOM motion catalog");
  return value.documents.map(parseDomMotionDocument);
}
