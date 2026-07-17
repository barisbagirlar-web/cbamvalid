import {
  DEFAULT_TOOL_CREATOR_MR_ID,
  getAcademicReferenceByMRId,
} from "./academic-references";
import { siteConfig } from "../site-config";

const defaultRef = getAcademicReferenceByMRId(DEFAULT_TOOL_CREATOR_MR_ID);

/** Reference creator shown on all calculator tool pages (E-E-A-T / author signal). */
export const TOOL_REFERENCE_CREATOR = {
  id: "neela-nataraj",
  name: defaultRef?.name ?? "Prof. Dr. Neela Nataraj",
  honorificPrefix: "Prof. Dr.",
  givenName: "Neela",
  familyName: "Nataraj",
  jobTitle: "Professor",
  mrId: defaultRef?.mrId ?? DEFAULT_TOOL_CREATOR_MR_ID,
  mathSciNetUrl:
    defaultRef?.mathSciNetUrl ??
    "https://mathscinet.ams.org/mathscinet/MRAuthorID/613458",
  affiliation: {
    "@type": "CollegeOrUniversity" as const,
    name: defaultRef?.affiliation ?? "Indian Institute of Technology Bombay",
    url: "https://www.iitb.ac.in/",
  },
  imagePath: "/img/creators/neela-nataraj.png",
  profileUrl: defaultRef?.profileUrl ?? "https://www.math.iitb.ac.in/~neela/",
  /** Set when a verified ORCID is available; omit rel=me head link when null. */
  orcidUrl: null as string | null,
  sameAs: [
    defaultRef?.profileUrl ?? "https://www.math.iitb.ac.in/~neela/",
    defaultRef?.mathSciNetUrl ??
      "https://mathscinet.ams.org/mathscinet/MRAuthorID/613458",
    "https://www.linkedin.com/posts/indian-institute-of-technology-bombay_prof-neela-nataraj-is-elected-to-be-part-activity-7275006741744939008-w0un/",
  ],
  knowsAbout: [
    "Industrial engineering",
    "Operations research",
    "Manufacturing analytics",
    "Decision analysis",
  ],
} as const;

export function toolReferenceCreatorJsonLdId(): string {
  return `${siteConfig.canonicalOrigin}/#neela-nataraj`;
}
