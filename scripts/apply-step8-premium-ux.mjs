import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function write(path, content) {
  writeFileSync(path, content, "utf8");
}

function replaceOnce(content, before, after, label) {
  const first = content.indexOf(before);
  if (first < 0) throw new Error(`PATCH_ANCHOR_MISSING: ${label}`);
  if (content.indexOf(before, first + before.length) >= 0) {
    throw new Error(`PATCH_ANCHOR_NOT_UNIQUE: ${label}`);
  }
  return content.slice(0, first) + after + content.slice(first + before.length);
}

function replaceRegexOnce(content, pattern, replacement, label) {
  const matches = [...content.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))];
  if (matches.length !== 1) throw new Error(`PATCH_REGEX_COUNT_${matches.length}: ${label}`);
  return content.replace(pattern, replacement);
}

const wizardValidationPath = "lib/cbam/wizard-validation.ts";
let validation = read(wizardValidationPath);
validation = replaceOnce(
  validation,
  '  READY_TO_LOCK: "Lock & download package",\n  LOCKING: "Creating package…",\n  LOCKED: "Open sealed release",\n  LOCK_FAILED: "Review remaining requirements",',
  '  READY_TO_LOCK: "Create sealed package",\n  LOCKING: "Creating package…",\n  LOCKED: "Open sealed release",\n  LOCK_FAILED: "Retry package creation",',
  "step8 CTA labels"
);
validation = replaceOnce(
  validation,
  '  const total = STEP_FIELD_SPECS[step - 1]?.length ?? 0;',
  '  // Only fields expanded for this case are applicable. Optional empty arrays\n  // (for example, no carbon-price deduction) must not leave a completed step\n  // permanently IN_PROGRESS.\n  const total = completed + missingFields;',
  "applicable step field total"
);
write(wizardValidationPath, validation);

const pagePath = "app/(workspace)/cases/[caseId]/page.tsx";
let page = read(pagePath);
page = replaceOnce(
  page,
  `        if (cachedCase) {\n          setInitialCase(JSON.parse(cachedCase));\n          setDataLoading(false);\n        }`,
  `        if (cachedCase) {\n          // Cache may accelerate the visual loading state, but it is never\n          // authoritative for release readiness or entitlement decisions. Keep\n          // the gate closed until the server returns the current case and pack.\n          setInitialCase(JSON.parse(cachedCase));\n        }`,
  "server-authoritative case mount"
);
write(pagePath, page);

const clientPath = "app/(workspace)/cases/[caseId]/CaseWizardClient.tsx";
let client = read(clientPath);
client = replaceOnce(
  client,
  `  const blockerPanelRef = useRef<HTMLDivElement | null>(null);\n  const [showBlockers, setShowBlockers] = useState(false);`,
  `  const blockerPanelRef = useRef<HTMLDivElement | null>(null);\n  const releaseCommandRef = useRef<HTMLElement | null>(null);\n  const [showBlockers, setShowBlockers] = useState(false);`,
  "release command ref"
);
client = replaceOnce(
  client,
  `  const [sealTone, setSealTone] = useState<"neutral" | "success" | "error" | "warning">("neutral");`,
  `  const [sealTone, setSealTone] = useState<"neutral" | "success" | "error" | "warning">("neutral");\n  const [sealProgress, setSealProgress] = useState<"IDLE" | "VALIDATING" | "CREATING" | "SUCCESS" | "ERROR">("IDLE");`,
  "seal progress state"
);
client = replaceOnce(
  client,
  `      const scoped = entitlement.scopeCaseId || entitlement.caseId;\n      const caseMatches = !scoped || scoped === caseData.caseId;\n      return caseMatches && ["AVAILABLE", "ACTIVE", "PURCHASED"].includes(status);`,
  `      const scoped = entitlement.scopeCaseId || entitlement.caseId;\n      const caseMatches = !scoped || scoped === caseData.caseId;\n      const entitlementId = typeof entitlement.entitlementId === "string"\n        ? entitlement.entitlementId.trim()\n        : "";\n      // A list row without its server identifier cannot be reserved or consumed.\n      // Never advertise READY_TO_LOCK from stale/incomplete cached metadata.\n      return Boolean(entitlementId) && caseMatches && ["AVAILABLE", "ACTIVE", "PURCHASED"].includes(status);`,
  "usable entitlement identity gate"
);
client = replaceOnce(
  client,
  `  const handleSeal = async () => {`,
  `  const focusReleaseCommand = () => {\n    requestAnimationFrame(() => {\n      releaseCommandRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });\n    });\n  };\n\n  const handleSeal = async () => {`,
  "release command focus helper"
);
client = replaceOnce(
  client,
  `        setSealTechnicalCode("CORRECTION_REASON_REQUIRED");\n        setSealTone("warning");\n        return;`,
  `        setSealTechnicalCode("CORRECTION_REASON_REQUIRED");\n        setSealTone("warning");\n        setSealProgress("ERROR");\n        focusReleaseCommand();\n        return;`,
  "correction feedback"
);
client = replaceOnce(
  client,
  `      setSealTechnicalCode("ENTITLEMENT_REQUIRED");\n      setSealTone("warning");\n      return;`,
  `      setSealTechnicalCode("ENTITLEMENT_REQUIRED");\n      setSealTone("warning");\n      setSealProgress("ERROR");\n      focusReleaseCommand();\n      return;`,
  "entitlement feedback"
);
client = replaceOnce(
  client,
  `    if (!sealRequestId.current) sealRequestId.current = crypto.randomUUID();\n    setSealing(true);\n    setSealStatus("");\n    setSealTechnicalCode("");\n    setSealTone("neutral");\n    try {\n      await persistDraft();\n      const response = await sealReport(`,
  `    if (!sealRequestId.current) sealRequestId.current = crypto.randomUUID();\n    setSealProgress("VALIDATING");\n    setSealing(true);\n    setSealStatus("Validating the latest working-file data and entitlement…");\n    setSealTechnicalCode("");\n    setSealTone("neutral");\n    focusReleaseCommand();\n    try {\n      await persistDraft();\n      setSealProgress("CREATING");\n      setSealStatus("All gates passed. Creating the controlled package and integrity manifest…");\n      const response = await sealReport(`,
  "immediate seal progress"
);
client = replaceOnce(
  client,
  `      setSealStatus(STEP8_SEALED_SUCCESS_HEADLINE);\n      setSealTone("success");\n      router.push(`,
  `      setSealProgress("SUCCESS");\n      setSealStatus(STEP8_SEALED_SUCCESS_HEADLINE);\n      setSealTone("success");\n      router.push(`,
  "seal success progress"
);
client = replaceOnce(
  client,
  `      setSealStatus(translated.userMessage);\n      setSealTechnicalCode(translated.technicalCode);\n      setSealTone("error");`,
  `      setSealProgress("ERROR");\n      setSealStatus(translated.userMessage);\n      setSealTechnicalCode(translated.technicalCode);\n      setSealTone("error");\n      focusReleaseCommand();`,
  "seal failure progress"
);
client = replaceOnce(
  client,
  `          <p className="mt-1 text-sm text-muted">Review readiness, payment and what the controlled package will include before you lock and download. Sealing stays fail-closed: every automated quality control and evidence requirement must pass, and payment must be in place.</p>\n        </div>\n\n        {scenarioActive && calculation.result && (`,
  `          <p className="mt-1 text-sm text-muted">Review the final gates and create the controlled package from one explicit release command. Every click produces an immediate, visible state and the server remains the authority for readiness, entitlement and sealing.</p>\n        </div>\n\n        <section\n          ref={releaseCommandRef}\n          aria-label="Release command center"\n          aria-live="polite"\n          aria-busy={sealing}\n          className={\`scroll-mt-24 rounded-2xl border-2 p-5 shadow-sm md:p-6 \${\n            step8Status === "BLOCKED"\n              ? "border-status-blocked/40 bg-[color:var(--status-blocked-soft)]"\n              : step8Status === "PAYMENT_REQUIRED"\n                ? "border-status-warning/40 bg-[color:var(--status-warning-soft)]"\n                : step8Status === "LOCK_FAILED"\n                  ? "border-status-blocked/40 bg-surface"\n                  : "border-accent/40 bg-surface"\n          }\`}\n        >\n          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">\n            <div className="max-w-3xl">\n              <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Release command center</p>\n              <h3 className="mt-2 font-serif text-2xl font-bold">\n                {step8Status === "BLOCKED"\n                  ? "Resolve the remaining requirements"\n                  : step8Status === "PAYMENT_REQUIRED"\n                    ? "Authorize this working file"\n                    : step8Status === "LOCKING"\n                      ? "Package creation is in progress"\n                      : step8Status === "LOCK_FAILED"\n                        ? "The previous attempt did not complete"\n                        : step8Status === "LOCKED"\n                          ? "Sealed release is ready"\n                          : "Ready to create the sealed package"}\n              </h3>\n              <p className="mt-2 text-sm leading-relaxed text-muted">\n                {step8Status === "BLOCKED"\n                  ? \`\${readiness.criticalBlockers.length} blocking requirement\${readiness.criticalBlockers.length === 1 ? "" : "s"} must be resolved. No payment or release capacity will be consumed.\`\n                  : step8Status === "PAYMENT_REQUIRED"\n                    ? \`All preparation controls passed. Pay \${CANONICAL_PRICING.priceFormatted} once to authorize this working file before package creation.\`\n                    : step8Status === "LOCKING"\n                      ? "Keep this page open. The server is validating the saved case, reserving release capacity and generating the signed package."\n                      : step8Status === "LOCK_FAILED"\n                        ? "Your draft is safe and the same idempotent request can be retried. The technical reason is shown below without hiding the next action."\n                        : "All preparation controls and the entitlement gate are confirmed. One action creates the immutable package and opens its release page."}\n              </p>\n            </div>\n            <Step8StateBadge status={step8Status} />\n          </div>\n\n          <div className="mt-5 grid gap-2 sm:grid-cols-3" aria-label="Package creation progress">\n            {[\n              { label: "1. Validate", detail: "Saved case + release entitlement", active: sealProgress === "VALIDATING", done: ["CREATING", "SUCCESS"].includes(sealProgress) },\n              { label: "2. Create", detail: "Reports + manifest + signature", active: sealProgress === "CREATING", done: sealProgress === "SUCCESS" },\n              { label: "3. Open", detail: "Immutable release and downloads", active: sealProgress === "SUCCESS", done: sealProgress === "SUCCESS" },\n            ].map((phase) => (\n              <div\n                key={phase.label}\n                className={\`rounded-lg border p-3 \${phase.done ? "border-forest-light bg-forest-pale" : phase.active ? "border-accent bg-accent/5" : "border-border bg-neutral-soft"}\`}\n              >\n                <p className="text-xs font-bold">{phase.label}</p>\n                <p className="mt-1 text-[11px] leading-relaxed text-muted">{phase.detail}</p>\n              </div>\n            ))}\n          </div>\n\n          <div className="mt-5">\n            {step8Status === "BLOCKED" && (\n              <button\n                type="button"\n                data-testid="step8-primary-action"\n                onClick={revealSealBlockers}\n                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-status-blocked px-5 py-3 text-sm font-bold text-surface-elevated sm:w-auto"\n              >\n                <AlertTriangle className="h-5 w-5" /> {STEP8_FOOTER_CTA_LABELS.BLOCKED}\n              </button>\n            )}\n            {step8Status === "PAYMENT_REQUIRED" && (\n              <Link\n                data-testid="step8-primary-action"\n                href={\`/credits/buy?caseId=\${encodeURIComponent(caseData.caseId || "")}\`}\n                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-surface sm:w-auto"\n              >\n                <LockKeyhole className="h-5 w-5" /> {STEP8_FOOTER_CTA_LABELS.PAYMENT_REQUIRED}\n              </Link>\n            )}\n            {(step8Status === "READY_TO_LOCK" || step8Status === "LOCK_FAILED") && (\n              <button\n                type="button"\n                data-testid="step8-primary-action"\n                onClick={handleSeal}\n                disabled={sealing}\n                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-surface shadow-sm transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"\n              >\n                <CheckCircle2 className="h-5 w-5" /> {step8Status === "LOCK_FAILED" ? STEP8_FOOTER_CTA_LABELS.LOCK_FAILED : STEP8_FOOTER_CTA_LABELS.READY_TO_LOCK}\n              </button>\n            )}\n            {step8Status === "LOCKING" && (\n              <button type="button" data-testid="step8-primary-action" disabled className="inline-flex min-h-12 w-full cursor-wait items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-surface opacity-80 sm:w-auto">\n                <Loader2 className="h-5 w-5 animate-spin" /> {STEP8_FOOTER_CTA_LABELS.LOCKING}\n              </button>\n            )}\n            {step8Status === "LOCKED" && (\n              <Link data-testid="step8-primary-action" href="/reports" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-status-pass px-5 py-3 text-sm font-bold text-surface-elevated sm:w-auto">\n                {STEP8_FOOTER_CTA_LABELS.LOCKED} <ArrowRight className="h-5 w-5" />\n              </Link>\n            )}\n          </div>\n\n          {sealStatus && <div className="mt-4"><StatusBanner status={sealStatus} tone={sealTone} /></div>}\n          {sealTechnicalCode && (\n            <details className="mt-3 rounded-lg border border-border bg-neutral-soft p-3">\n              <summary className="cursor-pointer text-xs font-semibold">Technical details</summary>\n              <p className="mt-2 break-all font-mono text-[10px] text-muted">{sealTechnicalCode}</p>\n            </details>\n          )}\n          <p className="mt-4 text-xs leading-relaxed text-muted">\n            Click once. Duplicate submissions are protected by one request identifier; failed or blocked attempts consume no release capacity.\n          </p>\n        </section>\n\n        {scenarioActive && calculation.result && (`,
  "premium release command center"
);
client = replaceOnce(
  client,
  `          <div className="rounded-lg border border-border bg-surface p-4">\n            <p className="text-xs font-semibold uppercase tracking-wider text-muted">External verifier</p>\n            <p className="mt-1 text-sm font-bold">PENDING</p>\n            <p className="mt-1 text-xs text-muted">Only an appropriately accredited independent verifier can issue a verification opinion.</p>\n          </div>`,
  `          <div className="rounded-lg border border-border bg-surface p-4">\n            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Independent verification</p>\n            <p className="mt-1 text-sm font-bold">POST-RELEASE</p>\n            <p className="mt-1 text-xs text-muted">Begins after package creation and does not block the operator working-file release.</p>\n          </div>`,
  "post-release verifier semantics"
);
client = replaceOnce(
  client,
  `Every automated preparation control has passed. Create the sealed package once payment is in place.`,
  `Every automated preparation control has passed. Use the Release command center above to create the package.`,
  "remaining actions success copy"
);
client = replaceOnce(
  client,
  `          <div className="mt-4"><StatusBanner status={sealStatus} tone={sealTone} /></div>\n          {sealTechnicalCode && (\n            <p className="mt-2 rounded border border-border bg-neutral-soft px-2 py-1 font-mono text-[10px] break-all text-muted" aria-label="Technical error code">\n              Technical code: {sealTechnicalCode}\n            </p>\n          )}\n          <p className="mt-3 text-xs text-muted">\n            Payment is for this working file only. Failed or blocked locks charge nothing. Re-download is free. The primary action is in the footer bar below.\n          </p>`,
  `          <p className="mt-4 text-xs text-muted">\n            Payment is for this working file only. Failed or blocked attempts charge nothing. Re-download is free. The authoritative action and live operation status are in the Release command center above.\n          </p>`,
  "single visible seal feedback source"
);
client = replaceOnce(
  client,
  `      case "BLOCKED":\n      case "LOCK_FAILED":\n        return (\n          <button\n            type="button"\n            onClick={revealSealBlockers}\n            className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded border border-status-blocked/50 bg-surface px-3 py-2 text-sm font-semibold text-status-blocked sm:flex-none sm:px-4"\n          >\n            <AlertTriangle className="h-4 w-4 shrink-0" /> {STEP8_FOOTER_CTA_LABELS.BLOCKED}\n          </button>\n        );`,
  `      case "BLOCKED":\n        return (\n          <button\n            type="button"\n            onClick={revealSealBlockers}\n            className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded border border-status-blocked/50 bg-surface px-3 py-2 text-sm font-semibold text-status-blocked sm:flex-none sm:px-4"\n          >\n            <AlertTriangle className="h-4 w-4 shrink-0" /> {STEP8_FOOTER_CTA_LABELS.BLOCKED}\n          </button>\n        );\n      case "LOCK_FAILED":\n        return (\n          <button\n            type="button"\n            onClick={handleSeal}\n            disabled={sealing}\n            className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded bg-accent px-3 py-2 text-sm font-semibold text-surface disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:px-4"\n          >\n            <LockKeyhole className="h-4 w-4 shrink-0" /> {STEP8_FOOTER_CTA_LABELS.LOCK_FAILED}\n          </button>\n        );`,
  "failed seal retry action"
);
client = replaceOnce(
  client,
  `    <main className="min-h-screen bg-background px-4 py-6 pb-24 text-foreground md:px-8">`,
  `    <main className="min-h-screen bg-background px-4 py-6 pb-32 text-foreground md:px-8">`,
  "footer clearance"
);
write(clientPath, client);

const footerTestPath = "tests/integration/wizard-footer.test.ts";
let footerTest = read(footerTestPath);
footerTest = replaceOnce(footerTest, 'expect(STEP8_FOOTER_CTA_LABELS.READY_TO_LOCK).toBe("Lock & download package");', 'expect(STEP8_FOOTER_CTA_LABELS.READY_TO_LOCK).toBe("Create sealed package");', "footer ready label test");
footerTest = replaceOnce(
  footerTest,
  '    expect(STEP8_FOOTER_CTA_LABELS.LOCKED).toBe("Open sealed release");',
  '    expect(STEP8_FOOTER_CTA_LABELS.LOCKED).toBe("Open sealed release");\n    expect(STEP8_FOOTER_CTA_LABELS.LOCK_FAILED).toBe("Retry package creation");',
  "footer retry label test"
);
footerTest = replaceOnce(footerTest, '    expect(client).toContain("pb-24");', '    expect(client).toContain("pb-32");', "footer clearance test");
write(footerTestPath, footerTest);

const semanticsTestPath = "tests/integration/wizard-status-semantics.test.ts";
let semantics = read(semanticsTestPath);
semantics = replaceOnce(
  semantics,
  `  it("no lock CTA while blockers are open: BLOCKED and PAYMENT_REQUIRED never carry a lock label", () => {\n    expect(STEP8_FOOTER_CTA_LABELS.BLOCKED).toBe("Review remaining requirements");\n    expect(STEP8_FOOTER_CTA_LABELS.LOCK_FAILED).toBe("Review remaining requirements");\n    expect(STEP8_FOOTER_CTA_LABELS.READY_TO_LOCK).toBe("Lock & download package");\n    // Only READY_TO_LOCK/LOCKING/LOCKED states may claim a lock action.\n    expect(STEP8_FOOTER_CTA_LABELS.BLOCKED).not.toMatch(/lock/i);\n    expect(STEP8_FOOTER_CTA_LABELS.LOCK_FAILED).not.toMatch(/lock/i);\n    expect(STEP8_FOOTER_CTA_LABELS.PAYMENT_REQUIRED).not.toMatch(/Lock & download/i);\n    expect(STEP8_FOOTER_CTA_LABELS.READY_TO_LOCK).toMatch(/Lock & download/i);\n    expect(STEP8_FOOTER_CTA_LABELS.LOCKING).toMatch(/Creating package/i);\n    expect(STEP8_FOOTER_CTA_LABELS.LOCKED).toMatch(/Open sealed release/i);\n  });`,
  `  it("keeps blocked/payment states fail-closed and gives a failed attempt an explicit retry", () => {\n    expect(STEP8_FOOTER_CTA_LABELS.BLOCKED).toBe("Review remaining requirements");\n    expect(STEP8_FOOTER_CTA_LABELS.PAYMENT_REQUIRED).toBe("Pay to unlock this working file");\n    expect(STEP8_FOOTER_CTA_LABELS.READY_TO_LOCK).toBe("Create sealed package");\n    expect(STEP8_FOOTER_CTA_LABELS.LOCK_FAILED).toBe("Retry package creation");\n    expect(STEP8_FOOTER_CTA_LABELS.BLOCKED).not.toMatch(/create sealed|retry/i);\n    expect(STEP8_FOOTER_CTA_LABELS.PAYMENT_REQUIRED).not.toMatch(/create sealed|retry/i);\n    expect(STEP8_FOOTER_CTA_LABELS.LOCKING).toMatch(/Creating package/i);\n    expect(STEP8_FOOTER_CTA_LABELS.LOCKED).toMatch(/Open sealed release/i);\n  });`,
  "status CTA semantics"
);
semantics = replaceOnce(
  semantics,
  `  it("payment readiness never claims lock-allowed while blockers are open", () => {`,
  `  it("marks an optional empty Step 7 as complete when no material gap remains", () => {\n    const ready = readyCase();\n    expect(ready.carbonPriceRecords).toHaveLength(0);\n    expect(validateWizardStep(7, ready).state).toBe("COMPLETE");\n  });\n\n  it("payment readiness never claims lock-allowed while blockers are open", () => {`,
  "optional step completion test"
);
write(semanticsTestPath, semantics);

const commandCenterTestPath = "tests/integration/step8-premium-release-command-center.test.ts";
write(commandCenterTestPath, `import { readFileSync } from "node:fs";\nimport path from "node:path";\nimport { describe, expect, it } from "vitest";\n\nconst readSource = (relative: string): string =>\n  readFileSync(path.join(process.cwd(), relative), "utf8");\n\ndescribe("Step 8 premium release command center", () => {\n  const client = readSource("app/(workspace)/cases/[caseId]/CaseWizardClient.tsx");\n\n  it("renders one explicit, always-visible command center with immediate operation feedback", () => {\n    expect(client).toContain('aria-label="Release command center"');\n    expect(client).toContain('data-testid="step8-primary-action"');\n    expect(client).toContain('setSealProgress("VALIDATING")');\n    expect(client).toContain('Validating the latest working-file data and entitlement');\n    expect(client).toContain('setSealProgress("CREATING")');\n    expect(client).toContain('Creating the controlled package and integrity manifest');\n  });\n\n  it("makes a failed package attempt retryable instead of sending a zero-blocker user to requirements", () => {\n    expect(client).toMatch(/case "LOCK_FAILED":[\\s\\S]*?onClick=\\{handleSeal\\}[\\s\\S]*?STEP8_FOOTER_CTA_LABELS\\.LOCK_FAILED/);\n    expect(client).toContain('step8Status === "LOCK_FAILED" ? STEP8_FOOTER_CTA_LABELS.LOCK_FAILED');\n  });\n\n  it("does not advertise a stale entitlement without its server identifier", () => {\n    expect(client).toContain('return Boolean(entitlementId) && caseMatches');\n  });\n\n  it("positions independent verification after the operator package rather than as a false blocker", () => {\n    expect(client).toContain("Independent verification");\n    expect(client).toContain("POST-RELEASE");\n    expect(client).toContain("does not block the operator working-file release");\n  });\n\n  it("does not mount an actionable wizard from stale local cache", () => {\n    const page = readSource("app/(workspace)/cases/[caseId]/page.tsx");\n    const cacheBlock = page.match(/if \\(cachedCase\\) \\{([\\s\\S]*?)\\n        \\}/)?.[1] || "";\n    expect(cacheBlock).toContain("setInitialCase");\n    expect(cacheBlock).not.toContain("setDataLoading(false)");\n    expect(page).toContain("server returns the current case and pack");\n  });\n});\n`);

for (const temporaryPath of [
  "scripts/apply-step8-premium-ux.mjs",
  ".github/workflows/apply-step8-premium-fix.yml",
]) {
  if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
}

console.log("STEP8_PREMIUM_PATCH_APPLIED");
