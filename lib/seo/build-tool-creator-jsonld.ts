import { siteConfig } from "../site-config";
import { TOOL_REFERENCE_CREATOR, toolReferenceCreatorJsonLdId } from "./tool-reference-creator";
import { ORGANIZATION_ID } from "./entity-graph";

export function buildToolReferenceCreatorPersonJsonLd() {
  return {
    "@type": "Person",
    "@id": toolReferenceCreatorJsonLdId(),
    name: TOOL_REFERENCE_CREATOR.name,
    honorificPrefix: TOOL_REFERENCE_CREATOR.honorificPrefix,
    givenName: TOOL_REFERENCE_CREATOR.givenName,
    familyName: TOOL_REFERENCE_CREATOR.familyName,
    jobTitle: TOOL_REFERENCE_CREATOR.jobTitle,
    description: "Academic Oversight & Expert Review — validates calculation methodologies against engineering first principles and industrial mathematics standards",
    image: `${siteConfig.canonicalOrigin}${TOOL_REFERENCE_CREATOR.imagePath}`,
    url: TOOL_REFERENCE_CREATOR.profileUrl,
    sameAs: TOOL_REFERENCE_CREATOR.sameAs,
    affiliation: {
      "@type": "CollegeOrUniversity",
      name: TOOL_REFERENCE_CREATOR.affiliation.name,
      url: TOOL_REFERENCE_CREATOR.affiliation.url,
    },
    memberOf: { "@id": ORGANIZATION_ID },
    knowsAbout: TOOL_REFERENCE_CREATOR.knowsAbout,
  };
}

export function buildToolPageCreatorGraph(input: {
  readonly toolName: string;
  readonly description?: string;
  readonly urlPath: string;
  readonly locale: string;
}) {
  const canonicalUrl = `${siteConfig.canonicalOrigin}${input.urlPath}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      buildToolReferenceCreatorPersonJsonLd(),
      {
        "@type": ["SoftwareApplication", "WebApplication"],
        name: input.toolName,
        description: input.description,
        url: canonicalUrl,
        inLanguage: input.locale,
        applicationCategory: "CalculatorApplication",
        operatingSystem: "Web",
        image: `${siteConfig.canonicalOrigin}${TOOL_REFERENCE_CREATOR.imagePath}`,
        author: { "@id": toolReferenceCreatorJsonLdId() },
        creator: { "@id": toolReferenceCreatorJsonLdId() },
        provider: { "@id": ORGANIZATION_ID },
      }
    ]
  };
}
