export interface SectorDetail {
  slug: string;
  name: string;
  headline: string;
  introduction: string;
  systemBoundary: string;
  precursorRules: string;
  electricityRules: string;
  regulationCitation: string;
  regulationUrl: string;
  /** ISO 8601 timestamp of last material content update. Used for sitemap lastmod. */
  contentLastModified: string;
}

export const SECTOR_DETAILS: Record<string, SectorDetail> = {
  cement: {
    slug: 'cement',
    name: 'Cement',
    headline: 'CBAM Compliance & Emissions Calculation for the Cement Sector',
    introduction: 'The cement sector is one of the most carbon-intensive sectors covered under EU Regulation (EU) 2023/956, characterized by high process emissions from calcination. Precise monitoring of raw material inputs and fuel combustion is required.',
    systemBoundary: 'The system boundary includes all processes directly and indirectly linked to the production of clinker and cement: raw meal preparation, calcination of limestone, kiln operation, clinker cooling, and cement grinding. Calcination CO2 emissions from raw materials must be explicitly calculated.',
    precursorRules: 'For pure cement types, precursor tracking is limited. However, when complex cements or blended hydraulic cements are manufactured, upstream clinker must be tracked as a primary precursor if sourced from a separate installation.',
    electricityRules: 'Indirect embedded emissions from electricity consumed in raw material preparation, kiln operation, and grinding mills are in scope and must be calculated using actual electricity consumption and grid/source emission factors.',
    regulationCitation: 'Regulation (EU) 2023/956 Annex I, Section 1 (Cement)',
    regulationUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R0956#anx_I',
    contentLastModified: '2026-07-15T09:00:00Z'
  },
  steel: {
    slug: 'steel',
    name: 'Iron and Steel',
    headline: 'CBAM Compliance & Emissions Calculation for the Iron & Steel Sector',
    introduction: 'The iron and steel sector includes a wide range of goods from primary pig iron to fabricated downstream steel structures. System boundaries depend heavily on whether the blast furnace (BF-BOF) or electric arc furnace (EAF) production route is used.',
    systemBoundary: 'The system boundary covers all production phases starting from ore/scrap processing, coke production, blast furnace reduction, oxygen furnace refining, casting, and hot/cold rolling. Sinter plant emissions and coke combustion must be fully allocated.',
    precursorRules: 'Precursor tracking is mandatory for complex steel goods. Sourced pig iron, sponge iron (DRI), and crude steel must be tracked with their actual embedded emissions or applicable default values.',
    electricityRules: 'Indirect emissions are in scope. During the transitional period, report emissions from electricity consumed in EAF operations, rolling mills, and pickling lines.',
    regulationCitation: 'Regulation (EU) 2023/956 Annex I, Section 2 (Iron and Steel)',
    regulationUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R0956#anx_I',
    contentLastModified: '2026-07-15T09:30:00Z'
  },
  aluminium: {
    slug: 'aluminium',
    name: 'Aluminium',
    headline: 'CBAM Compliance & Emissions Calculation for the Aluminium Sector',
    introduction: 'Aluminium CBAM scope covers unwrought aluminium, scrap, and downstream rolled, extruded, or foiled products. Electricity consumption in the Hall-Héroult electrolysis process represents the major emission source.',
    systemBoundary: 'System boundary includes anode baking, smelting (electrolysis bath), and ingot casting. For downstream products, it includes preheating, hot/cold rolling, extrusion, and drawing processes.',
    precursorRules: 'Unwrought aluminium (alloyed or non-alloyed) is a primary precursor for downstream products (plates, foil, tubes). Actual embedded emissions of precursors must be tracked.',
    electricityRules: 'Indirect emissions from electricity used in primary smelting are fully in scope and represent the dominant source of embedded carbon. Must be calculated with high precision.',
    regulationCitation: 'Regulation (EU) 2023/956 Annex I, Section 5 (Aluminium)',
    regulationUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R0956#anx_I',
    contentLastModified: '2026-07-15T10:00:00Z'
  },
  fertilisers: {
    slug: 'fertilisers',
    name: 'Fertilisers',
    headline: 'CBAM Compliance & Emissions Calculation for the Fertilisers Sector',
    introduction: 'The fertilisers sector includes nitric acid, ammonia, urea, and mixed mineral fertilisers. Direct emissions include CO2 from reforming and N2O from chemical synthesis.',
    systemBoundary: 'System boundary covers steam reforming (for ammonia), catalytic oxidation of ammonia (for nitric acid), and neutralisation/granulation steps. Nitrous oxide (N2O) emissions must be measured and converted using GWP values.',
    precursorRules: 'Ammonia and nitric acid are key precursors for downstream nitrate and complex fertilisers and must be accounted for.',
    electricityRules: 'Indirect emissions from grid electricity or on-site co-generation must be quantified and reported for all fertiliser manufacturing processes.',
    regulationCitation: 'Regulation (EU) 2023/956 Annex I, Section 4 (Fertilisers)',
    regulationUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R0956#anx_I',
    contentLastModified: '2026-07-15T10:30:00Z'
  },
  hydrogen: {
    slug: 'hydrogen',
    name: 'Hydrogen',
    headline: 'CBAM Compliance & Emissions Calculation for Hydrogen Production',
    introduction: 'Hydrogen is included in the CBAM scope to cover both fossil-based (SMR) and renewable/electrolytic production pathways. Carbon capture and storage (CCS) plays a significant role in actual value calculations.',
    systemBoundary: 'Includes natural gas reforming, water-gas shift reaction, purification (PSA), and water electrolysis. Includes combustion emissions from reform heating.',
    precursorRules: 'Pure hydrogen generally has no precursors in scope during the transitional phase unless imported raw chemical synthesis gases are utilized.',
    electricityRules: 'Indirect emissions are critical for water electrolysis. The electricity source (grid, PPA, or dedicated renewable) must be documented with certificates of origin.',
    regulationCitation: 'Regulation (EU) 2023/956 Annex I, Section 6 (Hydrogen)',
    regulationUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R0956#anx_I',
    contentLastModified: '2026-07-15T11:00:00Z'
  },
  electricity: {
    slug: 'electricity',
    name: 'Electricity',
    headline: 'CBAM Compliance & Grid Factor Calculation for Electricity Imports',
    introduction: 'Electrical energy imports into the EU are subject to specific grid factor calculation rules, differing from physical goods as emissions are calculated per MWh.',
    systemBoundary: 'Covers electricity generation at the plant level or grid-average emissions of the exporting country, calculated as tCO2e/MWh.',
    precursorRules: 'No precursors are applicable to electricity imports.',
    electricityRules: 'Direct emissions from generation are treated as indirect embedded emissions by the importer. Calculations rely on the EU default grid factor (0.45 tCO2e/MWh) or certified country-specific grid factors.',
    regulationCitation: 'Regulation (EU) 2023/956 Annex I, Section 3 (Electricity)',
    regulationUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R0956#anx_I',
    contentLastModified: '2026-07-15T11:30:00Z'
  },
  downstream: {
    slug: 'downstream',
    name: 'Downstream Complex Goods',
    headline: 'CBAM Compliance for Downstream Iron, Steel, and Aluminium Articles',
    introduction: 'Downstream complex goods include fabricated steel structures, pipes, and aluminium articles. Their embedded emissions are dominated by the upstream precursor materials.',
    systemBoundary: 'Includes secondary fabrication processes (cutting, welding, forming, surface treatment) plus the embedded emissions of all steel or aluminium precursors.',
    precursorRules: 'Mandatory precursor tracking. Upstream crude steel, hot-rolled coils, or primary aluminium ingots must be fully quantified with evidence of origin.',
    electricityRules: 'Indirect emissions from fabrication machinery and heating must be reported.',
    regulationCitation: 'Regulation (EU) 2023/956 Annex I (Downstream Complex Goods)',
    regulationUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R0956#anx_I',
    contentLastModified: '2026-07-15T12:00:00Z'
  }
};
