import { listGlossaryTerms } from "./aeo/glossary";

/** @deprecated Prefer listGlossaryTerms() — kept for niche keyword exports. */
export const CBAM_NICHE_TERMS = listGlossaryTerms().flatMap((term) => [
  term.name,
  ...term.aliases,
]);
