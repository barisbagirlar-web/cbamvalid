export interface LegalVersion {
  versionId: string;
  name: string;
  enactedAt: string;
  active: boolean;
}

export const LEGAL_VERSIONS: LegalVersion[] = [
  {
    versionId: "EU_2023_956",
    name: "Regulation (EU) 2023/956 of the European Parliament and of the Council establishing a carbon border adjustment mechanism",
    enactedAt: "2023-05-10T00:00:00Z",
    active: true,
  },
];

export function getLegalVersion(versionId: string): LegalVersion | null {
  return LEGAL_VERSIONS.find((v) => v.versionId === versionId) || null;
}
