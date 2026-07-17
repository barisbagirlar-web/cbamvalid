import { siteConfig } from "../site-config";
import { TOOL_REFERENCE_CREATOR } from "./tool-reference-creator";
import { ORGANIZATION_ID } from "./entity-graph";

const SHIPPING_DETAILS = {
  "@type": "OfferShippingDetails",
  shippingRate: {
    "@type": "MonetaryAmount",
    value: "0.00",
    currency: "USD",
  },
  deliveryTime: {
    "@type": "ShippingDeliveryTime",
    handlingTime: {
      "@type": "QuantitativeValue",
      minValue: 0,
      maxValue: 0,
      unitCode: "DAY",
    },
    transitTime: {
      "@type": "QuantitativeValue",
      minValue: 0,
      maxValue: 0,
      unitCode: "DAY",
    },
  },
} as const;

const RETURN_POLICY = {
  "@type": "MerchantReturnPolicy",
  returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
  merchantReturnDays: 14,
  returnMethod: "https://schema.org/ReturnByMail",
  returnFees: "https://schema.org/FreeReturn",
} as const;

export function buildCbamProductJsonLd(input: {
  readonly productName: string;
  readonly description: string;
  readonly path: string;
}) {
  const pageUrl = `${siteConfig.canonicalOrigin}${input.path}`;
  
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${pageUrl}#product`,
    name: input.productName,
    description: input.description,
    image: `${siteConfig.canonicalOrigin}/logo.png`,
    url: pageUrl,
    brand: {
      "@type": "Brand",
      name: siteConfig.organizationDisplayName,
      url: siteConfig.canonicalOrigin,
    },
    manufacturer: {
      "@type": "Organization",
      name: siteConfig.organizationDisplayName,
      "@id": ORGANIZATION_ID,
      url: siteConfig.canonicalOrigin,
    },
    offers: {
      "@type": "Offer",
      price: "149.00",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: pageUrl,
      shippingDetails: SHIPPING_DETAILS,
      hasMerchantReturnPolicy: RETURN_POLICY,
    },
    review: {
      "@type": "Review",
      author: {
        "@type": "Person",
        name: TOOL_REFERENCE_CREATOR.name,
        url: TOOL_REFERENCE_CREATOR.profileUrl,
        affiliation: {
          "@type": "CollegeOrUniversity",
          name: TOOL_REFERENCE_CREATOR.affiliation.name,
        },
      },
      reviewBody: "Industrial calculation methodology reviewed for formula transparency, regulatory compliance under EU CBAM, and sector applicability.",
      publisher: { "@id": ORGANIZATION_ID },
    },
  };
}
