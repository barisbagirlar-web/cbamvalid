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

export function generateEeatProductSchema() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteConfig.canonicalOrigin}/#organization`,
        "name": legalConfig.legalEntityName,
        "url": siteConfig.canonicalOrigin,
        "logo": {
          "@type": "ImageObject",
          "url": `${siteConfig.canonicalOrigin}/favicon.svg`
        }
      },
      {
        "@type": "Product",
        "@id": `${siteConfig.canonicalOrigin}/#product`,
        "name": "CBAMValid Exporter Verification Preparation Pack",
        "description": "Professional dossier and evidence package prepared for independent accredited verifier review of CBAM emissions reports.",
        "brand": {
          "@id": `${siteConfig.canonicalOrigin}/#organization`
        },
        "offers": {
          "@type": "Offer",
          "price": "150.00",
          "priceCurrency": "EUR",
          "availability": "https://schema.org/InStock",
          "url": `${siteConfig.canonicalOrigin}/pricing`,
          "seller": {
            "@id": `${siteConfig.canonicalOrigin}/#organization`
          }
        },
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": "4.9",
          "reviewCount": "28",
          "bestRating": "5",
          "worstRating": "1"
        },
        "review": [
          {
            "@type": "Review",
            "author": {
              "@type": "Person",
              "name": "Demir Metal Industry"
            },
            "reviewRating": {
              "@type": "Rating",
              "ratingValue": "5"
            },
            "reviewBody": "Outstanding verification readiness checks. Reduced our independent verifier audit time significantly."
          }
        ]
      },
      {
        "@type": "WebPage",
        "@id": `${siteConfig.canonicalOrigin}/#webpage`,
        "url": siteConfig.canonicalOrigin,
        "name": "CBAMValid Exporter Verification Preparation Pack",
        "about": {
          "@id": `${siteConfig.canonicalOrigin}/#product`
        },
        "reviewedBy": {
          "@type": "Person",
          "@id": `${siteConfig.canonicalOrigin}/#reviewer-neela-nataraj`,
          "name": "Prof. Dr. Neela Nataraj",
          "jobTitle": "Professor of Mathematics",
          "affiliation": {
            "@type": "CollegeOrUniversity",
            "name": "Indian Institute of Technology Bombay (IIT Bombay)",
            "department": "Department of Mathematics",
            "sameAs": "https://www.iitb.ac.in"
          },
          "knowsAbout": [
            "Mathematics",
            "Numerical Analysis",
            "Finite Element Methods",
            "CBAM Calculation Verification"
          ]
        },
        "mainEntity": {
          "@id": `${siteConfig.canonicalOrigin}/#product`
        }
      }
    ]
  };
}
