export type AcademicReferenceRole = "author" | "reviewer" | "advisor";

export interface AcademicReference {
  readonly id: string;
  readonly name: string;
  readonly mrId: number;
  readonly mathSciNetUrl: string;
  readonly affiliation: string;
  readonly profileUrl?: string;
  readonly role?: AcademicReferenceRole;
}

export const academicReferences: readonly AcademicReference[] = [
  {
    id: "neela-nataraj",
    name: "Prof. Dr. Neela Nataraj",
    mrId: 613458,
    mathSciNetUrl: "https://mathscinet.ams.org/mathscinet/MRAuthorID/613458",
    profileUrl: "https://www.math.iitb.ac.in/~neela/",
    affiliation: "Indian Institute of Technology Bombay",
    role: "author",
  },
  {
    id: "wil-schilders",
    name: "Prof. Dr. Wilhelmus HA Schilders",
    mrId: 155995,
    mathSciNetUrl: "https://mathscinet.ams.org/mathscinet/MRAuthorID/155995",
    profileUrl: "https://www.ecmi-indmath.org/",
    affiliation: "TU Eindhoven / ICIAM",
    role: "advisor",
  },
  {
    id: "carsten-carstensen",
    name: "Prof. Dr. Carsten Carstensen",
    mrId: 263782,
    mathSciNetUrl: "https://mathscinet.ams.org/mathscinet/MRAuthorID/263782",
    profileUrl: "https://www2.mathematik.hu-berlin.de/~carstensen/",
    affiliation: "Humboldt University of Berlin",
    role: "reviewer",
  },
  {
    id: "roger-fletcher",
    name: "Prof. Roger Fletcher",
    mrId: 195165,
    mathSciNetUrl: "https://mathscinet.ams.org/mathscinet/MRAuthorID/195165",
    affiliation: "University of Dundee",
    role: "reviewer",
  },
  {
    id: "carol-woodward",
    name: "Dr. Carol S. Woodward",
    mrId: 632964,
    mathSciNetUrl: "https://mathscinet.ams.org/mathscinet/MRAuthorID/632964",
    profileUrl: "https://www.siam.org/publications/siam-news/articles/siam-president-carol-woodward/",
    affiliation: "Lawrence Livermore National Laboratory / SIAM",
    role: "advisor",
  },
] as const;

export const DEFAULT_TOOL_CREATOR_MR_ID = 613458;

export function getAcademicReferenceByMRId(mrId: number) {
  return academicReferences.find((ref) => ref.mrId === mrId);
}
