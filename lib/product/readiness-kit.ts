/**
 * Onboarding readiness kit SSOT (FAZ 4 / T4.2).
 */
export const READINESS_TIME_HONESTY =
  "2–4 hours if your data is ready. 2–3 weeks if starting from zero." as const;

export const READINESS_CHECKLIST = [
  {
    id: "identity-scope",
    title: "Identity & scope",
    items: [
      "Legal operator / exporter name as on commercial documents",
      "Installation name, country, and address",
      "Reporting year and period dates",
      "Production route and system boundary decision",
    ],
  },
  {
    id: "goods-cn",
    title: "Goods & CN codes",
    items: [
      "CN codes for goods in scope",
      "Production quantity per good (tonnes)",
      "Simple vs complex goods classification",
      "Precursor applicability decision",
    ],
  },
  {
    id: "activity-emissions",
    title: "Activity data & emissions",
    items: [
      "Direct emissions for the period (or measurement basis)",
      "Electricity consumption and grid factor where required",
      "Fuel / process activity data supporting the calc path",
      "Allocation method if multiple goods share sources",
    ],
  },
  {
    id: "evidence",
    title: "Evidence files",
    items: [
      "Meters, invoices, lab reports, or process logs for each material input",
      "SHA-ready PDFs or sheets (clear issue dates and periods)",
      "Internal review status path to APPROVED / SUPPORTED",
      "Field-to-evidence links planned before seal",
    ],
  },
] as const;

export const PREFLIGHT_XLSX_HREF = "/onboarding/cbamvalid-preflight-checklist.xlsx" as const;
export const PREFLIGHT_CSV_HREF = "/onboarding/cbamvalid-preflight-checklist.csv" as const;
