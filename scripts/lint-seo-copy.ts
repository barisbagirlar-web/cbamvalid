import { seoRegistry } from "../lib/seo/registry";
import { CBAM_NICHE_TERMS } from "../lib/seo/niche-terms";

const VERBS = ["Calculate", "Validate", "Prepare", "Generate", "Assess", "Review", "Compare", "Identify", "Build", "Verify", "Understand"];
const FILLER_WORDS = ["best", "easy", "easily", "fast", "quick", "guaranteed", "official", "approved", "certified", "perfect", "instant"];

let hasError = false;

function error(msg: string) {
  console.error(`[SEO COPY ERROR] ${msg}`);
  hasError = true;
}

function warn(msg: string) {
  console.warn(`[SEO COPY WARN] ${msg}`);
}

for (const [path, meta] of Object.entries(seoRegistry)) {
  if (!meta.indexable) continue;

  // R1: H1 length maximum 65 characters
  if (meta.h1.length > 65) {
    error(`${path}: H1 length (${meta.h1.length}) exceeds 65 characters.`);
  }

  // R2: H1 includes a meaningful action or outcome verb
  // Exception for Legal/About/Contact/FAQ/etc
  if (!["legal", "about", "contact"].includes(meta.pageType)) {
    const hasVerb = VERBS.some(v => meta.h1.toLowerCase().includes(v.toLowerCase()));
    if (!hasVerb) {
      error(`${path}: H1 does not include an approved action verb.`);
    }
  }

  // R3: Title target: 50–60 characters. Meta description: 140–160 characters.
  if (meta.title.length < 50 || meta.title.length > 60) {
    warn(`${path}: Title length (${meta.title.length}) is outside 50-60 target.`);
  }
  if (meta.description.length < 140 || meta.description.length > 160) {
    warn(`${path}: Description length (${meta.description.length}) is outside 140-160 target.`);
  }

  // R6: Meta description includes the primary keyword and a meaningful action
  if (!meta.description.toLowerCase().includes(meta.primaryKeyword.toLowerCase())) {
    error(`${path}: Meta description missing primary keyword "${meta.primaryKeyword}".`);
  }
  if (!["legal", "about", "contact"].includes(meta.pageType)) {
    const hasVerbDesc = VERBS.some(v => meta.description.toLowerCase().includes(v.toLowerCase()));
    if (!hasVerbDesc) {
      error(`${path}: Meta description does not include an approved action verb.`);
    }
  }

  // R8: The exact primaryKeyword appears in title or H1.
  const pk = meta.primaryKeyword.toLowerCase();
  if (!meta.title.toLowerCase().includes(pk) && !meta.h1.toLowerCase().includes(pk)) {
    error(`${path}: primaryKeyword "${meta.primaryKeyword}" not found in Title or H1.`);
  }

  // R9: Ban unsupported generic filler
  const combinedText = `${meta.title} ${meta.description} ${meta.h1}`.toLowerCase();
  for (const filler of FILLER_WORDS) {
    if (combinedText.includes(` ${filler} `)) {
      error(`${path}: Contains banned filler word "${filler}".`);
    }
  }

  // R10: pain and outcome must include at least one approved CBAM domain term
  const painOutcome = `${meta.pain} ${meta.outcome}`.toLowerCase();
  const hasDomainTerm = CBAM_NICHE_TERMS.some(t => painOutcome.includes(t.toLowerCase()));
  if (!hasDomainTerm) {
    error(`${path}: Pain/Outcome missing CBAM domain terms.`);
  }
}

if (hasError) {
  console.error("SEO Copy Lint Failed!");
  process.exit(1);
} else {
  console.log("SEO Copy Lint Passed.");
}
