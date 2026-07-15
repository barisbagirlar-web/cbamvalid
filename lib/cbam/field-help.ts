export interface FieldHelpContent {
  source: string;
  evidence: string;
  format: string;
}

export const fieldHelpData = {
  importerLegalName: {
    source: "Use the legal name registered for the EU importer or indirect customs representative.",
    evidence: "Commercial registry extract or current EORI registration record.",
    format: "Enter the full legal name; do not use a trading name alone.",
  },
  exporterLegalName: {
    source: "Use the legal name in the non-EU operator/exporter company register.",
    evidence: "Commercial registry extract, tax registration or signed operator declaration.",
    format: "Enter the full legal name exactly as it appears on the evidence.",
  },
  declarantEori: {
    source: "Obtain the active EORI from the importer or indirect customs representative.",
    evidence: "EU customs/EORI registration evidence or an importer-issued document showing the number.",
    format: "Two-letter country prefix followed by 6–15 alphanumeric characters; no spaces.",
  },
  reportingYear: {
    source: "Use the reporting year covered by the production, emissions and shipment records.",
    evidence: "Monitoring plan and reporting-period records.",
    format: "Four-digit year from 2026 onward.",
  },
  reportingQuarter: {
    source: "Use the reporting period agreed for this dossier and matched by all source documents.",
    evidence: "Monitoring plan, production ledger and electricity invoices for the same period.",
    format: "Use a consistent period label such as Q1 or 2026-Q1.",
  },
  cnCode: {
    source: "Obtain the CN classification from the EU importer, customs declaration or binding classification record.",
    evidence: "Customs declaration, binding tariff information or product classification file.",
    format: "Enter exactly 8 digits with no spaces or punctuation.",
  },
  cbamSector: {
    source: "Select the sector that matches the declared CN code and the installation production route.",
    evidence: "CN classification reasoning and production-process documentation.",
    format: "Choose one supported CBAM sector; do not infer it from the product name alone.",
  },
  productionQuantity: {
    source: "Use the installation production ledger for the reporting period, reconciled to inventory and dispatch records.",
    evidence: "ERP production report, weighbridge records, stock movement ledger or metered output report.",
    format: "Positive net quantity in the selected unit; exclude out-of-period production.",
  },
  productionUnit: {
    source: "Use the unit stated in the production ledger or weighbridge records.",
    evidence: "The same production evidence used for the quantity.",
    format: "Select tonnes or kilograms; the engine normalizes kilograms to tonnes.",
  },
  shipmentDescription: {
    source: "Use the product description from invoices, packing lists and shipment records.",
    evidence: "Commercial invoice, packing list, bill of lading or dispatch ledger.",
    format: "Identify the product and shipment population covered by this goods row.",
  },
  allocationShare: {
    source: "Derive the share from the documented allocation method for common installation emissions.",
    evidence: "Allocation workbook, production ledger and accepted methodology decision.",
    format: "Decimal fraction greater than 0 and at most 1; all goods must sum to 1.",
  },
  installationName: {
    source: "Use the legal or operational installation name in permits and monitoring records.",
    evidence: "Operating permit, environmental permit or monitoring plan.",
    format: "Enter the specific production installation, not only the parent company.",
  },
  installationCountry: {
    source: "Use the country where the physical production installation is located.",
    evidence: "Operating permit, registered address or installation declaration.",
    format: "Country name or ISO country code used consistently across the dossier.",
  },
  productionRoute: {
    source: "Obtain the route from the installation process map and responsible technical personnel.",
    evidence: "Process flow diagram, monitoring plan and production-route description.",
    format: "State the actual route, technology and relevant furnace/process type.",
  },
  systemBoundary: {
    source: "Use the approved monitoring plan to define included and excluded processes, source streams and energy flows.",
    evidence: "Monitoring plan, process map and boundary methodology decision.",
    format: "Write an explicit boundary statement; unexplained exclusions must not be omitted.",
  },
  directEmissions: {
    source: "Use the installation monitoring system for combustion and process emissions within the reporting boundary.",
    evidence: "Fuel/activity ledger, laboratory analyses, meter records and direct-emissions calculation workbook.",
    format: "Total tCO2e for the reporting period; do not enter an intensity value.",
  },
  electricityConsumed: {
    source: "Use metered electricity consumed by the covered production processes for the reporting period.",
    evidence: "Electricity meters, supplier invoices and an allocation reconciliation where meters cover wider operations.",
    format: "MWh. Convert kWh to MWh by dividing by 1,000.",
  },
  gridEmissionFactor: {
    source: "Use the factor permitted by the active CBAM methodology and applicable to the electricity source, geography and reporting period.",
    evidence: "Official factor dataset or documented supplier/installation-specific factor with version and period reference.",
    format: "tCO2e/MWh, for example 0.4344. Decimal comma is accepted and normalized to a dot. Divide kgCO2e/MWh or gCO2e/kWh by 1,000.",
  },
  emissionsUnit: {
    source: "Match the unit printed on the underlying calculation or measurement record.",
    evidence: "The evidence linked to the corresponding emissions input.",
    format: "Use only the unit offered by the field; convert the source value before entry.",
  },
  sourceType: {
    source: "Classify how the value was obtained: measured/operator data, secondary data, default, estimate or regulatory value.",
    evidence: "Select the classification supported by the linked document and methodology decision.",
    format: "Estimated values require an accepted estimate methodology before sealing.",
  },
  precursorName: {
    source: "Use the precursor name from the bill of materials and supplier/operator emissions data.",
    evidence: "Bill of materials, purchase record and precursor emissions communication.",
    format: "Use a specific material or goods name that can be linked to its quantity and emissions.",
  },
  precursorCountry: {
    source: "Obtain the production origin from the precursor supplier, not the shipping or invoicing country alone.",
    evidence: "Supplier declaration, certificate of origin or production-installation record.",
    format: "Country name or ISO country code used consistently.",
  },
  precursorQuantity: {
    source: "Use the consumed precursor quantity from the bill of materials, ERP issue records or mass balance.",
    evidence: "Material consumption ledger, bill of materials and mass-balance reconciliation.",
    format: "Positive quantity in tonnes; convert kilograms by dividing by 1,000.",
  },
  precursorDirectEmissions: {
    source: "Use the precursor operator's reported direct embedded emissions attributable to the consumed quantity.",
    evidence: "Operator emissions communication and supporting calculation/evidence package.",
    format: "Total tCO2e attributable to the entered precursor quantity, not tCO2e per tonne.",
  },
  precursorIndirectEmissions: {
    source: "Use the precursor operator's reported indirect embedded emissions attributable to the consumed quantity.",
    evidence: "Operator emissions communication, electricity data and factor record.",
    format: "Total tCO2e attributable to the entered precursor quantity, not tCO2e per tonne.",
  },
  carbonPriceAmountPaid: {
    source: "Use the net carbon price actually paid in the country of origin after rebates or compensation.",
    evidence: "Official assessment, tax invoice, payment receipt and rebate documentation.",
    format: "Non-negative monetary amount in the selected currency.",
  },
  carbonPriceApplicableEmissions: {
    source: "Use the emissions quantity to which the evidenced carbon-price payment legally applies.",
    evidence: "Carbon-price assessment and calculation tying payment to the covered emissions.",
    format: "Non-negative tCO2e; it must reconcile to the payment evidence.",
  },
  carbonPriceCurrency: {
    source: "Use the currency shown on the official payment record.",
    evidence: "Payment receipt or official carbon-price assessment.",
    format: "Select EUR, USD, GBP or TRY exactly as evidenced.",
  },
  legislationReference: {
    source: "Copy the legal instrument and provision under which the carbon price was imposed.",
    evidence: "Official assessment or government source identifying the applicable legislation.",
    format: "Include instrument name/number and relevant article or provision.",
  },
  paymentEvidence: {
    source: "Select the uploaded file that proves the carbon price was assessed and paid.",
    evidence: "Approved, supported and malware-clean payment evidence.",
    format: "The selected evidence must belong to this case and reporting period.",
  },
  evidenceFile: {
    source: "Upload the original source document used to support a material input.",
    evidence: "PDF, spreadsheet, CSV, image or text file issued or retained in the ordinary course of operations.",
    format: "Use an unaltered file; the system records byte size and SHA-256 hash.",
  },
  evidenceDocumentType: {
    source: "Classify the document by its actual business purpose.",
    evidence: "Use the document title and issuing context.",
    format: "Use a stable, specific type such as ELECTRICITY_INVOICE or PRODUCTION_LEDGER.",
  },
  evidenceIssuer: {
    source: "Use the organization or system that issued the document.",
    evidence: "Issuer shown on the document or verifiable system export metadata.",
    format: "Full legal entity or authoritative internal system/department name.",
  },
  evidenceIssueDate: {
    source: "Use the issue/export date printed in the document metadata.",
    evidence: "The uploaded file itself.",
    format: "ISO calendar date; it must be compatible with the reporting period.",
  },
  evidenceLinkedInput: {
    source: "Select the exact case input directly supported by the uploaded document.",
    evidence: "The document must contain the value or a traceable reference to its derivation.",
    format: "Upload separate evidence or create explicit links where one document supports multiple inputs.",
  },
  evidenceReviewNotes: {
    source: "Record the internal review performed against the input, period, issuer and calculation use.",
    evidence: "Reviewer observations from inspecting the uploaded file.",
    format: "State what was checked, the supported field and any limitation; avoid generic approval text.",
  },
} as const satisfies Record<string, FieldHelpContent>;

export type FieldHelpKey = keyof typeof fieldHelpData;

export const requiredFieldHelpKeys = Object.freeze(
  Object.keys(fieldHelpData) as FieldHelpKey[]
);
