export type RecordedExpectation = {
  accepted: boolean;
  artifact: string;
  archiveBytes: number;
  archiveSha256: string;
  effectKinds?: string[];
  primaryCode?: string;
};

export type BundleDocumentDeclaration = {
  id: string;
  path: string;
  byteLength: number;
  sha256: string;
  schemaVersion: string;
};
export type BundleAssetDeclaration = {
  path: string;
  byteLength: number;
  sha256: string;
  kind: "audio" | "image" | "svg";
  mimeType: string;
};
export type VerifiedManifest = {
  manifestVersion: string;
  version: string;
  engineVersion: string;
  effectDocuments: BundleDocumentDeclaration[];
  assets: BundleAssetDeclaration[];
};

export function parseRecordedExpectation(value: unknown): RecordedExpectation {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Corpus expectation must be an object.");
  }
  if (
    !("accepted" in value) ||
    typeof value.accepted !== "boolean" ||
    !("artifact" in value) ||
    typeof value.artifact !== "string" ||
    !("archiveBytes" in value) ||
    typeof value.archiveBytes !== "number" ||
    !Number.isSafeInteger(value.archiveBytes) ||
    value.archiveBytes < 1 ||
    !("archiveSha256" in value) ||
    typeof value.archiveSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.archiveSha256)
  ) {
    throw new Error(
      "Corpus expectation identity or archive metadata is invalid.",
    );
  }
  let effectKinds: string[] | undefined;
  if ("effectKinds" in value) {
    if (!Array.isArray(value.effectKinds))
      throw new Error("Corpus effect kinds must be an array.");
    const entries: unknown[] = value.effectKinds;
    effectKinds = entries.map((kind) => {
      if (typeof kind !== "string")
        throw new Error("Corpus effect kinds must be strings.");
      return kind;
    });
  }
  if ("primaryCode" in value && typeof value.primaryCode !== "string") {
    throw new Error("Corpus primary diagnostic code must be a string.");
  }
  return {
    accepted: value.accepted,
    artifact: value.artifact,
    archiveBytes: value.archiveBytes,
    archiveSha256: value.archiveSha256,
    ...(effectKinds === undefined ? {} : { effectKinds }),
    ...("primaryCode" in value && typeof value.primaryCode === "string"
      ? { primaryCode: value.primaryCode }
      : {}),
  };
}
