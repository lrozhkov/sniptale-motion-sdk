import { responseField, responseString } from "../../test/fixtures/response.ts";

export type StudioReady = {
  project: string;
  url: string;
  viewerOrigin: string;
  sandboxOrigin: string;
  session: string;
};

export function parseStudioReady(value: unknown): StudioReady {
  if (
    responseField(value, "ok") !== true ||
    responseField(value, "command") !== "studio"
  ) {
    throw new Error(
      "Studio readiness must report a successful studio command.",
    );
  }
  const url = responseString(value, "url");
  const address = new URL(url);
  const session = address.searchParams.get("studioSession");
  if (!session)
    throw new Error("Studio readiness must include a session token.");
  const viewerOrigin = responseString(value, "viewerOrigin");
  const sandboxOrigin = responseString(value, "sandboxOrigin");
  if (address.origin !== viewerOrigin || viewerOrigin === sandboxOrigin) {
    throw new Error(
      "Studio readiness must use separate viewer and sandbox origins.",
    );
  }
  return {
    project: responseString(value, "project"),
    url,
    viewerOrigin,
    sandboxOrigin,
    session,
  };
}
