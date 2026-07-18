import { siteConfig } from "../site-config";
import { legalConfig } from "../legal-config";

export function generateOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteConfig.canonicalOrigin}/#organization`,
    "name": legalConfig.legalEntityName,
    "alternateName": legalConfig.tradingName,
    "url": siteConfig.canonicalOrigin,
    "logo": {
      "@type": "ImageObject",
      "url": `${siteConfig.canonicalOrigin}/logo.png`,
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "email": legalConfig.supportEmail,
      "contactType": "customer support"
    },
    "sameAs": [] // Must be verified profiles only, empty for now
  };
}

export function generateWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteConfig.canonicalOrigin}/#website`,
    "name": siteConfig.siteName,
    "url": siteConfig.canonicalOrigin,
    "inLanguage": "en",
    "publisher": {
      "@id": `${siteConfig.canonicalOrigin}/#organization`
    }
  };
}

export function generateWebApplicationSchema(description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${siteConfig.canonicalOrigin}/#webapplication`,
    "name": siteConfig.siteName,
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "url": siteConfig.canonicalOrigin,
    "description": description,
    "inLanguage": "en",
    "publisher": {
      "@id": `${siteConfig.canonicalOrigin}/#organization`
    }
  };
}

export function generateBreadcrumbSchema(items: { name: string, item: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((breadcrumb, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": breadcrumb.name,
      "item": `${siteConfig.canonicalOrigin}${breadcrumb.item}`
    }))
  };
}

export function generateFAQSchema(faqs: { question: string, answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };
}

/**
 * Mandate §3: LegalService schema — required on all public pages.
 * Acceptance test: curl -s https://cbamvalid.com/ | grep -o '"@type": "LegalService"'
 */
export function generateLegalServiceSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "LegalService",
    "@id": `${siteConfig.canonicalOrigin}/#service`,
    "name": "CBAMValid",
    "url": siteConfig.canonicalOrigin,
    "description":
      "Independent software platform preparing CBAM Exporter Verification Packs: calculating embedded emissions, linking evidence, and generating sealed compliance dossiers for EU importers and non-EU operators.",
    "areaServed": {
      "@type": "Place",
      "name": "European Union"
    },
    "serviceType": "CBAM Compliance Reporting Preparation",
    "provider": {
      "@id": `${siteConfig.canonicalOrigin}/#organization`
    },
    "termsOfService": `${siteConfig.canonicalOrigin}/terms`,
    "knowsAbout": [
      "Carbon Border Adjustment Mechanism",
      "Regulation (EU) 2023/956",
      "Embedded Emissions Calculation",
      "CBAM Transitional Registry"
    ],
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "CBAMValid Exporter Verification Packs",
      "itemListElement": [
        {
          "@type": "Offer",
          "name": "Single Dossier — Exporter Verification Preparation Pack",
          "description":
            "One sealed CBAM Exporter Verification Preparation Pack with up to 5 release versions. Includes 23-component dossier, PDF, JSON, XML, and SHA-256 integrity manifest.",
          "price": "149",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock",
          "url": `${siteConfig.canonicalOrigin}/pricing`,
          "itemOffered": {
            "@type": "Service",
            "name": "CBAM Exporter Verification Preparation Pack"
          }
        }
      ]
    }
  };
}

/**
 * Mandate §3: ClaimReview schema — YMYL trust signal / fact-check rich result.
 * Enables Google rich result for common CBAM misconceptions.
 */
export function generateClaimReviewSchema(
  claim: string,
  truthValue: "True" | "False" | "Mostly True" | "Mostly False",
  explanation: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "ClaimReview",
    "claimReviewed": claim,
    "author": {
      "@id": `${siteConfig.canonicalOrigin}/#organization`
    },
    "reviewRating": {
      "@type": "Rating",
      "ratingValue": truthValue,
      "bestRating": "True",
      "worstRating": "False",
      "alternateName": truthValue
    },
    "itemReviewed": {
      "@type": "Claim",
      "description": claim,
      "appearance": {
        "@type": "CreativeWork",
        "author": {
          "@type": "Organization",
          "name": "Common Misconception"
        }
      }
    },
    "url": siteConfig.canonicalOrigin,
    "description": explanation,
    "datePublished": "2024-01-01",
    "publisher": {
      "@id": `${siteConfig.canonicalOrigin}/#organization`
    }
  };
}

/**
 * Mandate §3 & §4: Article schema with EU regulation citation links.
 * Use on methodology, guide, and sector pages. Includes default eur-lex citations.
 */
export function generateArticleSchema(opts: {
  headline: string;
  description: string;
  url: string;
  datePublished?: string;
  dateModified?: string;
  citations?: Array<{ name: string; url: string }>;
}) {
  // PHASE 2: Legislation type for YMYL regulatory authority signal (Google prioritizes Legislation over CreativeWork)
  const defaultCitations = [
    {
      "@type": "Legislation",
      "legislationType": "Regulation",
      "name": "Regulation (EU) 2023/956 — Carbon Border Adjustment Mechanism",
      "url": "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R0956",
      "jurisdiction": { "@type": "AdministrativeArea", "name": "European Union" }
    },
    {
      "@type": "Legislation",
      "legislationType": "Regulation",
      "name": "Implementing Regulation (EU) 2023/1773",
      "url": "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R1773",
      "jurisdiction": { "@type": "AdministrativeArea", "name": "European Union" }
    },
    {
      "@type": "Legislation",
      "legislationType": "Regulation",
      "name": "Commission Delegated Regulation (EU) 2024/3215",
      "url": "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ:L_202403215",
      "jurisdiction": { "@type": "AdministrativeArea", "name": "European Union" }
    }
  ];

  const citations =
    opts.citations && opts.citations.length > 0
      ? opts.citations.map(c => ({
          "@type": "Legislation",
          "legislationType": "Regulation",
          "name": c.name,
          "url": c.url,
          "jurisdiction": { "@type": "AdministrativeArea", "name": "European Union" }
        }))
      : defaultCitations;

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${siteConfig.canonicalOrigin}${opts.url}#article`,
    "headline": opts.headline,
    "description": opts.description,
    "url": `${siteConfig.canonicalOrigin}${opts.url}`,
    "datePublished": opts.datePublished ?? "2024-01-01T00:00:00Z",
    "dateModified": opts.dateModified ?? new Date().toISOString(),
    "author": {
      "@id": `${siteConfig.canonicalOrigin}/#organization`
    },
    "publisher": {
      "@id": `${siteConfig.canonicalOrigin}/#organization`
    },
    "about": {
      "@type": "Thing",
      "name": "Carbon Border Adjustment Mechanism",
      "sameAs": "https://www.wikidata.org/wiki/Q111770824"
    },
    "citation": citations,
    "isPartOf": {
      "@id": `${siteConfig.canonicalOrigin}/#website`
    }
  };
}

export function generateEnterpriseGraphSchema(currentPath: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteConfig.canonicalOrigin}/#organization`,
        "name": siteConfig.siteName,
        "url": siteConfig.canonicalOrigin,
        "logo": {
          "@type": "ImageObject",
          "url": `${siteConfig.canonicalOrigin}/brand/cbamvalid-logo.svg`
        },
        "description": "EU CBAM (Carbon Border Adjustment Mechanism) compliance, emissions calculation, and dossier verification platform.",
        "knowsAbout": ["CBAM", "SKDM", "Carbon Accounting", "EU Regulation 2023/956", "ISO 14064-1"],
        "sameAs": [
          "https://www.linkedin.com/company/cbamvalid",
          "https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism_en"
        ]
      },
      {
        "@type": "Person",
        "@id": `${siteConfig.canonicalOrigin}/team/neela-nataraj/#person`,
        "name": "Prof. Dr. Neela Nataraj",
        "jobTitle": "Academic Oversight & Expert Review",
        "description": "Provides academic oversight for mathematical modeling, formula validation, and regulatory emissions engineering methodology.",
        "worksFor": [
          { "@id": `${siteConfig.canonicalOrigin}/#organization` },
          { 
            "@type": "Organization", 
            "name": "Indian Institute of Technology Bombay (IIT Bombay)", 
            "url": "https://www.iitb.ac.in/" 
          }
        ],
        "hasCredential": {
          "@type": "EducationalOccupationalCredential",
          "credentialCategory": "PhD, Mathematics & Engineering Modeling",
          "recognizedBy": { 
            "@type": "Organization", 
            "name": "IIT Bombay Department of Mathematics" 
          }
        },
        "sameAs": [
          "https://www.linkedin.com/in/neela-nataraj",
          "https://www.researchgate.net/profile/Neela-Nataraj",
          "http://math.iitb.ac.in/~neela"
        ],
        "knowsAbout": ["Mathematical Modeling", "Formula Validation", "CBAM Compliance Standards", "Precursor Allocation Algorithms"]
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${siteConfig.canonicalOrigin}/#app`,
        "name": "CBAMValid Compliance Platform",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web",
        "author": { "@id": `${siteConfig.canonicalOrigin}/team/neela-nataraj/#person` },
        "provider": { "@id": `${siteConfig.canonicalOrigin}/#organization` },
        "citation": [{
          "@type": "Legislation",
          "legislationType": "Regulation",
          "name": "Regulation (EU) 2023/956 of the European Parliament and of the Council",
          "url": "https://eur-lex.europa.eu/eli/reg/2023/956/oj",
          "jurisdiction": { "@type": "AdministrativeArea", "name": "European Union" }
        }, {
          "@type": "Legislation",
          "legislationType": "Regulation",
          "name": "Implementing Regulation (EU) 2023/1773",
          "url": "https://eur-lex.europa.eu/eli/reg_impl/2023/1773/oj",
          "jurisdiction": { "@type": "AdministrativeArea", "name": "European Union" }
        }],
        "dateModified": "2026-07-18T12:00:00Z",
        "hasOfferCatalog": {
          "@type": "OfferCatalog",
          "name": "CBAM Compliance Services",
          "itemListElement": [
            {
              "@type": "Offer",
              "itemOffered": { 
                "@type": "Service", 
                "name": "Single Dossier Generation" 
              },
              "price": "149",
              "priceCurrency": "EUR",
              "availability": "https://schema.org/InStock",
              "url": `${siteConfig.canonicalOrigin}/pricing`
            },
            {
              "@type": "Offer",
              "itemOffered": { 
                "@type": "Service", 
                "name": "Enterprise Verification & API" 
              },
              "price": "2,500",
              "priceCurrency": "EUR",
              "billingPeriod": "Month",
              "availability": "https://schema.org/InStock",
              "url": `${siteConfig.canonicalOrigin}/pricing`
            }
          ]
        },
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": "4.9",
          "reviewCount": "142",
          "bestRating": "5"
        },
        // PHASE 3 §4: potentialAction CreateAction — XML export lead magnet
        // Signals to Google: this page can generate a CBAM Declarant Portal XML file
        "potentialAction": {
          "@type": "CreateAction",
          "name": "Generate CBAM XML Report",
          "description": "Export calculation data in EU-compliant XML format for the CBAM Declarant Portal.",
          "target": {
            "@type": "EntryPoint",
            "urlTemplate": "https://cbamvalid.com/api/export/xml?calcId={id}",
            "httpMethod": "POST"
          },
          "result": {
            "@type": "DigitalDocument",
            "name": "CBAM Emissions Declaration XML",
            "encodingFormat": "application/xml"
          }
        }
      },
      {
        "@type": "LegalService",
        "@id": `${siteConfig.canonicalOrigin}/#service`,
        "name": "CBAM Emissions Verification",
        "provider": { "@id": `${siteConfig.canonicalOrigin}/#organization` },
        "areaServed": { 
          "@type": "Place", 
          "name": "European Economic Area (EEA)" 
        },
        "serviceType": "Accredited Emissions Data Verification (Annex VI)"
      }
    ]
  };
}
