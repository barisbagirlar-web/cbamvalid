import { siteConfig } from "../site-config";
import { academicReferences, AcademicReference } from "./academic-references";
import { TOOL_REFERENCE_CREATOR } from "./tool-reference-creator";

export const ORGANIZATION_ID = `${siteConfig.canonicalOrigin}/#organization`;
export const FOUNDER_ID = `${siteConfig.canonicalOrigin}/#founder-baris-bagirlar`;
export const WEBSITE_ID = `${siteConfig.canonicalOrigin}/#website`;
export const PRODUCT_ID = `${siteConfig.canonicalOrigin}/#product`;

const ACADEMIC_ROLE_LABELS: Record<string, string> = {
  "neela-nataraj": "Academic Oversight & Expert Review — validates calculation methodologies against engineering first principles and industrial mathematics standards",
  "wil-schilders": "Scientific Advisory Board — industrial mathematics and model order reduction",
  "carsten-carstensen": "Scientific Advisory Board — mathematical modeling and finite element methods",
  "roger-fletcher": "Scientific Advisory Board — numerical optimization and algorithms",
  "carol-woodward": "Scientific Advisory Board — scientific computing and mathematical software",
};

function academicPersonNode(ref: AcademicReference) {
  const sameAs = ref.profileUrl ? [ref.mathSciNetUrl, ref.profileUrl] : [ref.mathSciNetUrl];
  const roleLabel = ACADEMIC_ROLE_LABELS[ref.id] ?? "Scientific Advisory Board";
  const isNataraj = ref.id === "neela-nataraj";

  return {
    "@type": "Person",
    "@id": `${siteConfig.canonicalOrigin}/#${ref.id}`,
    name: ref.name,
    honorificPrefix: isNataraj ? "Prof. Dr." : "Prof.",
    description: roleLabel,
    affiliation: {
      "@type": "CollegeOrUniversity",
      name: ref.affiliation,
    },
    memberOf: { "@id": ORGANIZATION_ID },
    sameAs,
    identifier: {
      "@type": "PropertyValue",
      propertyID: "MathSciNetAuthorID",
      value: String(ref.mrId),
    },
  };
}

export function buildEntityGraph(locale: string = "en") {
  const organizationDescription = "CBAMValid is a production-grade verifier-preparation software platform assisting exporters and operators in validating CBAM compliance evidence and generating sealed dossiers.";

  return {
    "@context": "https://schema.org",
    "@graph": [
      // === CORE ORGANIZATION ===
      {
        "@type": "Organization",
        "@id": ORGANIZATION_ID,
        name: siteConfig.organizationDisplayName,
        url: siteConfig.canonicalOrigin,
        logo: siteConfig.logoUrl,
        description: organizationDescription,
        email: siteConfig.organizationEmail,
        founder: { "@id": FOUNDER_ID },
        address: {
          "@type": "PostalAddress",
          streetAddress: siteConfig.organizationAddress,
          addressLocality: "Dublin 2",
          addressCountry: siteConfig.organizationCountry,
        },
        contactPoint: {
          "@type": "ContactPoint",
          email: siteConfig.organizationEmail,
          contactType: "customer support",
        },
        knowsAbout: [
          "Carbon Border Adjustment Mechanism",
          "Embedded Emissions Calculation",
          "EU ETS Regulations",
          { "@id": PRODUCT_ID },
        ],
        member: academicReferences.map((ref) => ({ "@id": `${siteConfig.canonicalOrigin}/#${ref.id}` })),
        foundingDate: "2026",
        hasCredential: {
          "@type": "EducationalOccupationalCredential",
          name: "Academic Oversight by Prof. Dr. Neela Nataraj",
          description: "All calculation methodologies are reviewed against engineering first principles and industrial mathematics standards under academic supervision.",
          recognizedBy: { "@id": `${siteConfig.canonicalOrigin}/#neela-nataraj` },
        },
      },
      {
        "@type": "Person",
        "@id": FOUNDER_ID,
        name: "Baris Bagirlar",
        email: "baris" + "bagirlar" + "@" + "gmail.com",
        jobTitle: "Founder & Lead Architect",
        url: `${siteConfig.canonicalOrigin}/about`,
        worksFor: { "@id": ORGANIZATION_ID },
        sameAs: [
          "https://github.com/barisbagirlar-web",
          "https://www.linkedin.com/in/barisbagirlar",
        ],
        knowsAbout: "CBAM Compliance, Web Software Architecture, Security Engineering",
      },
      // === ACADEMIC ADVISORS (E-E-A-T) ===
      ...academicReferences.map(academicPersonNode),
      // === WEBSITE ===
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        name: siteConfig.organizationDisplayName,
        url: siteConfig.canonicalOrigin,
        inLanguage: locale,
        publisher: { "@id": ORGANIZATION_ID },
      },
    ],
  };
}
