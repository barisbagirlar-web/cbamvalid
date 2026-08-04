import { CBAM_WORKFLOW_STEPS } from "@/lib/cbam/workflow-definition";

/**
 * Customer-facing product language (workspace + guided journey).
 * Internal ledger may still use credits; customers see software unlocks and working files.
 * Do not weaken SEO claim discipline — public pages keep verified claims SSOT.
 */
export const CUSTOMER_LANGUAGE = {
  product: "Working File Software Unlock",
  workingFile: "Working file",
  workingFiles: "Working files",
  lockedPackage: "Locked digital package",
  lockedPackages: "Locked digital packages",
  home: "Home",
  sealAction: "Lock & download",
  buyPack: "Pay to lock this file",
  activatePack: "Activate unused software unlock",
  continueFile: "Continue working file",
  createFile: "Create your first working file",
  oneLineStory:
    "Work free on one factory + one year file. Pay once to lock it. Correct and re-lock the same file as needed. A new file needs a new payment.",
} as const;

/**
 * Derived from the single workflow SSOT (lib/cbam/workflow-definition.ts).
 * Kept for callers that consumed the legacy plain step list; titles and
 * descriptions now come exclusively from CBAM_WORKFLOW_STEPS.
 */
export const WORKFLOW_STEPS_PLAIN = CBAM_WORKFLOW_STEPS.map((step) => ({
  num: step.id,
  title: step.title,
  desc: step.description,
}));
