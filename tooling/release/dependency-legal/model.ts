export type LegalScope = "production" | "development-only";
export type ProjectLicenseSettings = {
  path: string;
  sourceUrl: string;
  sourcePath: string;
  sourceSha256: string;
  expectedSha256: string;
  title: string;
  sourceCopyright: string;
  copyright: string;
};
export type ReviewedDecision = {
  packageName: string;
  version: string;
  licenseExpression: string;
  requiredScope: LegalScope;
  disposition: string;
  correspondingSourceUrl?: string;
};
export type PinnedSource = {
  packageName: string;
  version: string;
  licenseExpression: string;
  sourcePath: string;
  originUrl: string;
  sha256: string;
  packageResolved: string;
  packageIntegrity: string;
};
export type LegalSettings = {
  schemaVersion: 1;
  firstPartyLicense: string;
  reportDirectory: string;
  projectLicense: ProjectLicenseSettings;
  automaticallyAcceptedLicenses: string[];
  deniedLicenses: string[];
  reviewedDecisions: ReviewedDecision[];
  pinnedSources: PinnedSource[];
};
export type LegalOptions = {
  repoRoot?: string | undefined;
  lockfilePath?: string | undefined;
  settingsPath?: string | undefined;
};
export type LockRecord = {
  name?: string;
  version: string;
  license: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  dev?: boolean;
  optional?: boolean;
  devOptional?: boolean;
  link?: boolean;
  inBundle?: boolean;
  resolved?: string;
  integrity?: string;
};
export type LockPackages = Readonly<Record<string, LockRecord>>;
export type LegalComponent = {
  packageName: string;
  packagePath: string;
  version: string;
  licenseExpression: string;
  scope: LegalScope;
  resolved?: string;
  integrity?: string;
};
export type ProductionComponent = Omit<
  LegalComponent,
  "scope" | "resolved" | "integrity"
> & {
  resolved: string;
  integrity: string;
};
export type LicenseFinding = {
  code: string;
  summary: string;
  packageName?: string;
  version?: string;
  packagePath?: string;
};
export type LegalProvenance = {
  originUrl: string;
  sha256: string;
  sourcePath: string;
};
export type LegalManifestEntry = {
  packageName: string;
  version: string;
  packagePath: string;
  licenseExpression: string;
  licenseSourceKind: "installed-file" | "pinned-upstream";
  licenseSource: string;
  archivePath: string;
  sha256: string;
  sourceUrl: string;
  packageResolved: string;
  licenseProvenance?: LegalProvenance;
  correspondingSourceUrl?: string;
  notice?: { source: string; archivePath: string; sha256: string };
};
export type LegalBundle = {
  entries: LegalManifestEntry[];
  licenseFiles: { archivePath: string; contents: Buffer }[];
};
export type LegalMaterial = {
  kind: "installed-file" | "pinned-upstream";
  source: string;
  contents: Buffer;
  provenance?: LegalProvenance;
};
export type LegalComparisonFinding = { code: string; target: string };
export type LegalState = {
  schemaVersion: 1;
  status: "passed" | "failed";
  packageCount: number;
  scopeCounts: Record<string, number>;
  licenseCounts: Record<string, number>;
  components: LegalComponent[];
  findings: LicenseFinding[];
  settings: LegalSettings;
  packages: LockPackages;
};
export type LegalAuditReport = Omit<LegalState, "settings" | "packages">;
export type LegalOutputOptions = {
  repoRoot?: string | undefined;
  outputRoot?: string | undefined;
  policyPath?: string | undefined;
};
