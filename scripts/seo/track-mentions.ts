export type MentionObservation = {
  sourceUrl: string;
  sourceTitle: string;
  brandMentioned: boolean;
  linkedToSite: boolean;
  contactHint: string | null;
};

export type MentionDraft = {
  sourceUrl: string;
  sourceTitle: string;
  status: "DRAFT_ONLY";
  contactHint: string | null;
  draft: string;
};

export function buildUnlinkedMentionDrafts(rows: readonly MentionObservation[]): MentionDraft[] {
  return rows
    .filter((row) => row.brandMentioned && !row.linkedToSite)
    .map((row) => ({
      sourceUrl: row.sourceUrl,
      sourceTitle: row.sourceTitle,
      status: "DRAFT_ONLY" as const,
      contactHint: row.contactHint,
      draft: `Thank you for mentioning CBAMValid in “${row.sourceTitle}”. If it is useful for your readers, please consider linking the mention to https://cbamvalid.com/.`,
    }));
}

export function assertNoAutomaticEmail(mode: string): void {
  if (mode !== "draft-only") throw new Error("Phase 13 unlinked-mention outreach must remain draft-only; automatic email is prohibited");
}

function main() {
  assertNoAutomaticEmail("draft-only");
  const drafts = buildUnlinkedMentionDrafts([]);
  console.log(`SEO_MENTION_RESULT=${JSON.stringify({ status: "SKIP_NO_DATA", drafts, automaticEmail: false })}`);
}

if (process.argv[1]?.endsWith("track-mentions.ts")) main();
