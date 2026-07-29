export type RouteExperience = {
  audience: "public" | "customer" | "administrator";
  primaryTask: string;
  primaryAction: string;
  successOutcome: string;
  legalBoundary?: string;
};

const EXACT_ROUTE_EXPERIENCE: Record<string, RouteExperience> = {
  "/": {
    audience: "public",
    primaryTask: "Understand the product and start a working file",
    primaryAction: "Start a free working file",
    successOutcome: "The user reaches registration with /cases/new intent preserved",
  },
  "/pricing": {
    audience: "public",
    primaryTask: "Understand scope and price before starting",
    primaryAction: "Start a free working file",
    successOutcome: "The user creates or selects a file before case-scoped checkout",
  },
  "/verify": {
    audience: "public",
    primaryTask: "Check the integrity status of a package",
    primaryAction: "Verify package",
    successOutcome: "Active, superseded, revoked, invalid, and unavailable states are distinct",
    legalBoundary: "Integrity confirmation is not an accredited verification opinion",
  },
  "/login": {
    audience: "public",
    primaryTask: "Sign in and continue the original task",
    primaryAction: "Sign in",
    successOutcome: "The validated internal next path is preserved",
  },
  "/register": {
    audience: "public",
    primaryTask: "Create an account and continue the original task",
    primaryAction: "Create account",
    successOutcome: "The validated internal next path is preserved",
  },
  "/cbam": {
    audience: "customer",
    primaryTask: "Continue the most relevant working file",
    primaryAction: "Continue working file",
    successOutcome: "The user reaches the file in one action",
  },
  "/cases": {
    audience: "customer",
    primaryTask: "Choose a working file",
    primaryAction: "Continue",
    successOutcome: "Progress, blockers, and next action are visible before technical IDs",
  },
  "/cases/new": {
    audience: "customer",
    primaryTask: "Create one working file safely",
    primaryAction: "Create working file",
    successOutcome: "One idempotent file is created and opened",
  },
  "/cases/[caseId]": {
    audience: "customer",
    primaryTask: "Complete the active working-file step",
    primaryAction: "Save and continue",
    successOutcome: "Step, draft, case, and payment context remain intact",
    legalBoundary: "Mandatory verifier boundary remains accessible without obscuring the form",
  },
  "/credits/buy": {
    audience: "customer",
    primaryTask: "Pay to unlock one identified working file",
    primaryAction: "Pay to lock this file",
    successOutcome: "Successful payment returns to the same file at step 8",
  },
  "/reports": {
    audience: "customer",
    primaryTask: "Open or download a locked package",
    primaryAction: "Open package",
    successOutcome: "Errors are never presented as an empty package list",
  },
  "/cbam/reports/[reportId]": {
    audience: "customer",
    primaryTask: "Download and inspect a locked package",
    primaryAction: "Download package",
    successOutcome: "Readiness and missing data are presented truthfully",
  },
  "/account": {
    audience: "customer",
    primaryTask: "Check payment and paid-file access",
    primaryAction: "Open working files",
    successOutcome: "Partial failures never appear as missing purchases or access",
  },
  "/admin": {
    audience: "administrator",
    primaryTask: "Choose an operational administration task",
    primaryAction: "Open task",
    successOutcome: "Only implemented, authorized tasks are navigable",
  },
};

const PREFIX_EXPERIENCE: Array<[string, RouteExperience]> = [
  ["/admin/", {
    audience: "administrator",
    primaryTask: "Complete the named authorized administration task",
    primaryAction: "Complete task",
    successOutcome: "The task succeeds or gives a specific recovery action",
  }],
  ["/verify/", {
    audience: "public",
    primaryTask: "Inspect package integrity and status",
    primaryAction: "Verify or download",
    successOutcome: "Status and recovery are explicit",
    legalBoundary: "Integrity confirmation is not an accredited verification opinion",
  }],
  ["/enterprise/", {
    audience: "public",
    primaryTask: "Assess enterprise fit and request scoping",
    primaryAction: "Request scoping",
    successOutcome: "The inquiry can be started without reading internal implementation language",
  }],
  ["/cn-code/", {
    audience: "public",
    primaryTask: "Understand the selected CN code and choose the next preparation action",
    primaryAction: "Start or review scope",
    successOutcome: "The answer and next action are visible before supporting detail",
  }],
  ["/dashboard", {
    audience: "customer",
    primaryTask: "Reach the canonical customer destination",
    primaryAction: "Continue",
    successOutcome: "A server redirect resolves without a blank intermediate screen",
  }],
];

export function getRouteExperience(route: string): RouteExperience {
  const exact = EXACT_ROUTE_EXPERIENCE[route];
  if (exact) return exact;

  const prefix = PREFIX_EXPERIENCE.find(([candidate]) => route.startsWith(candidate));
  if (prefix) return prefix[1];

  if (route.startsWith("/cases/")) {
    return EXACT_ROUTE_EXPERIENCE["/cases/[caseId]"];
  }

  return {
    audience: "public",
    primaryTask: "Understand this topic and choose the relevant next step",
    primaryAction: "Continue",
    successOutcome: "The primary answer and next action appear before supporting detail",
  };
}
