import { seoRegistry } from "../lib/seo/registry";
import { CBAM_NICHE_TERMS } from "../lib/seo/niche-terms";

const VERBS = [
  "Calculate",
  "Validate",
  "Prepare",
  "Generate",
  "Assess",
  "Review",
  "Compare",
  "Identify",
  "Build",
  "Verify",
  "Understand",
  "Open",
  "Start",
  "See",
];
const FILLER_WORDS = [
  "best",
  "easy",
  "easily",
  "fast",
  "quick",
  "guaranteed",
  "official",
  "approved",
  "certified",
  "perfect",
  "instant",
];

let hasError = false;

function error(msg: string) {
  console.error(`[SEO COPY ERROR] ${msg}`);
  hasError = true;
}

function warn(msg: string) {
  console.warn(`[SEO COPY WARN] ${msg}`);
}

for (const [path, meta] of Object.entries(seoRegistry)) {
  if (meta.indexability !== "index") continue;

  if (meta.h1.length > 80) {
    error(`${path}: H1 length (${meta.h1.length}) exceeds 80 characters.`);
  }

  if (!["legal", "about", "contact", "cn-detail", "guide"].includes(meta.pageType)) {
    const hasVerb = VERBS.some((v) => meta.h1.toLowerCase().includes(v.toLowerCase()));
    if (!hasVerb) {
      warn(`${path}: H1 does not include an approved action verb.`);
    }
  }

  if (meta.title.length < 30 || meta.title.length > 70) {
    warn(`${path}: Title length (${meta.title.length}) is outside 30-70 guidance.`);
  }
  if (meta.description.length < 110 || meta.description.length > 180) {
    warn(`${path}: Description length (${meta.description.length}) is outside 110-180 guidance.`);
  }

  const intent = meta.primaryIntent.toLowerCase();
  const titleOrH1 = `${meta.title} ${meta.h1}`.toLowerCase();
  if (!titleOrH1.includes(intent.split(" ")[0] ?? intent)) {
    warn(`${path}: primaryIntent may be weakly represented in title/H1.`);
  }

  const combinedText = `${meta.title} ${meta.description} ${meta.h1}`.toLowerCase();
  for (const filler of FILLER_WORDS) {
    if (combinedText.includes(` ${filler} `)) {
      error(`${path}: Contains banned filler word "${filler}".`);
    }
  }

  const intentBlob = `${meta.primaryIntent} ${meta.description}`.toLowerCase();
  const hasDomainTerm = CBAM_NICHE_TERMS.some((t) => intentBlob.includes(t.toLowerCase()));
  if (!hasDomainTerm && meta.pageType !== "legal" && meta.pageType !== "contact") {
    warn(`${path}: Intent/description missing common CBAM domain terms.`);
  }
}

if (hasError) {
  console.error("SEO Copy Lint Failed!");
  process.exit(1);
} else {
  console.log("SEO Copy Lint Passed.");
}
