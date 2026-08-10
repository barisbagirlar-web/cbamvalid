import { appendFileSync } from "node:fs";

export const VALID_V6_PHASES = Object.freeze([
  "bootstrap",
  ...Array.from({ length: 20 }, (_, index) => `faz-${String(index).padStart(2, "0")}`),
]);

const VALID_SET = new Set(VALID_V6_PHASES);

export function resolveV6Phase({ eventName, dispatchPhase = "", headRef = "" }) {
  if (eventName === "workflow_dispatch") {
    if (!VALID_SET.has(dispatchPhase)) {
      throw new Error(`Invalid V6 phase: ${dispatchPhase || "<empty>"}`);
    }
    return { phase: dispatchPhase, phaseScoped: true };
  }

  if (eventName !== "pull_request") {
    throw new Error(`Unsupported V6 workflow event: ${eventName || "<empty>"}`);
  }

  if (headRef.startsWith("seo/bootstrap-")) {
    return { phase: "bootstrap", phaseScoped: true };
  }

  const fazMatch = /^seo\/faz-([0-9]{2})-/.exec(headRef);
  if (fazMatch) {
    const phase = `faz-${fazMatch[1]}`;
    if (!VALID_SET.has(phase)) {
      throw new Error(`Invalid V6 phase: ${phase}`);
    }
    return { phase, phaseScoped: true };
  }

  if (headRef.startsWith("seo/")) {
    throw new Error(`Malformed V6 SEO branch: ${headRef}`);
  }

  return { phase: "", phaseScoped: false };
}

function main() {
  const result = resolveV6Phase({
    eventName: process.env.GITHUB_EVENT_NAME ?? "",
    dispatchPhase: process.env.DISPATCH_PHASE ?? "",
    headRef: process.env.GITHUB_HEAD_REF ?? "",
  });

  const phaseScoped = result.phaseScoped ? "true" : "false";
  console.log(`SEO_PHASE_SCOPED=${phaseScoped}`);
  if (result.phase) console.log(`SEO_PHASE_RESOLVED=${result.phase}`);
  else console.log(`SEO_PHASE_RESOLVED=NON_SEO_PR`);

  const output = process.env.GITHUB_OUTPUT;
  if (output) {
    appendFileSync(output, `phase=${result.phase}\nphase_scoped=${phaseScoped}\n`, "utf8");
  }
}

if (process.argv[1]?.endsWith("resolve-v6-phase.mjs")) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 4;
  }
}
