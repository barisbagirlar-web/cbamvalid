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
