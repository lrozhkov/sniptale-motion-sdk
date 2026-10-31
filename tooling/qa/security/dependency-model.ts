export type DependencyIdentity = {
  name: string;
  version: string;
  integrity?: string;
  resolved?: string;
};
export type RegistryPackage = Required<DependencyIdentity>;
export type SecurityFixRecord = {
  name: string;
  version: string;
  advisory: string;
  reason: string;
  expiresAt: string;
};
export type RegistryMetadata = {
  time: Readonly<Record<string, string | undefined>>;
  versions?: Readonly<
    Record<
      string,
      | {
          dist: { integrity: string; tarball: string };
        }
      | undefined
    >
  >;
};
export type RegistryEvidence = Readonly<
  Record<string, RegistryMetadata | undefined>
>;
