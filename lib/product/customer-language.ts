/**
 * Customer-facing product language (workspace + guided journey).
 * Internal ledger may still use credits; customers see packs and working files.
 * Do not weaken SEO claim discipline — public pages keep verified claims SSOT.
 */
export const CUSTOMER_LANGUAGE = {
  product: "Exporter Verification Preparation Pack",
  workingFile: "Working file",
  workingFiles: "Working files",
  lockedPackage: "Locked package",
  lockedPackages: "Locked packages",
  home: "Home",
  sealAction: "Lock & download",
  buyPack: "Pay to lock this file",
  activatePack: "Activate unused balance",
  continueFile: "Continue working file",
  createFile: "Create your first working file",
  oneLineStory:
    "Work free on one factory + one year file. Pay once to lock it. Correct and re-lock the same file as needed. A new file needs a new payment.",
} as const;

export const WORKFLOW_STEPS_PLAIN = [
  { num: 1, title: "Who and where", desc: "Operator, installation, and reporting year." },
  { num: 2, title: "What you sell", desc: "Goods and CN codes." },
  { num: 3, title: "How you make it", desc: "Production route and boundaries." },
  { num: 4, title: "Direct emissions", desc: "Installation direct emissions for the reporting period." },
  { num: 5, title: "Electricity", desc: "Electricity use and indirect-emissions factor." },
  { num: 6, title: "Bought inputs", desc: "Precursors and their embedded emissions, if applicable." },
  { num: 7, title: "Proof documents", desc: "Carbon-price records and evidence review." },
  { num: 8, title: "Fix, lock & download", desc: "Clear blockers and create the sealed package." },
] as const;
