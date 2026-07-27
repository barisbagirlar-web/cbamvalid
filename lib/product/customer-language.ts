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
  buyPack: "Buy Preparation Pack",
  activatePack: "Activate pack",
  continueFile: "Continue working file",
  createFile: "Create your first working file",
  oneLineStory:
    "One factory + one year = one working file. Fill it in, then lock and download. You can lock up to five times for corrections.",
} as const;

export const WORKFLOW_STEPS_PLAIN = [
  { num: 1, title: "Who and where", desc: "Operator, installation, and reporting year." },
  { num: 2, title: "What you sell", desc: "Goods and CN codes." },
  { num: 3, title: "How you make it", desc: "Production route and boundaries." },
  { num: 4, title: "Emissions numbers", desc: "Direct and indirect embedded emissions." },
  { num: 5, title: "Bought inputs", desc: "Precursors and adjustments, if any." },
  { num: 6, title: "Proof documents", desc: "Link invoices, meters, and records." },
  { num: 7, title: "Fix blockers", desc: "Clear automated quality checks." },
  { num: 8, title: "Lock & download", desc: "Create the sealed package for your buyer or verifier." },
] as const;
