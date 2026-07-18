/**
 * PHASE 3 §3: Passage Indexing FactBox — AI Overview & Featured Snippet Optimized
 *
 * Protocol: Google AI Overview and SGE extract self-contained question-answer
 * pairs marked with FAQPage schema. This component injects a semantically
 * tagged "Fact Box" that AI models can directly cite as "Source: CBAMValid".
 *
 * Schema.org FAQPage microdata is embedded via itemScope/itemProp for
 * maximal parser compatibility (Google, Perplexity, ChatGPT Browse).
 */

import Link from 'next/link';

interface FactBoxProps {
  /** The question Google/AI users are asking (e.g. "What is the CBAM benchmark for CN 2523?") */
  question: string;
  /** Self-contained answer with factual density (50+ words, regulation citations, numeric values) */
  answer: string;
  /** Regulation source for cite element (e.g. "Regulation (EU) 2023/1773 Annex III") */
  sourceRegulation: string;
  /** EUR-Lex URL for the source regulation */
  sourceUrl: string;
  /** Optional CN code for schema enrichment */
  cnCode?: string;
}

export function PassageIndexingFactBox({
  question,
  answer,
  sourceRegulation,
  sourceUrl,
  cnCode,
}: FactBoxProps) {
  return (
    <section
      className='border-l-4 border-accent bg-accent/5 rounded-r-lg p-5 my-6'
      itemScope
      itemType='https://schema.org/FAQPage'
      aria-labelledby={cnCode ? `factbox-${cnCode}` : 'factbox-heading'}
    >
      {/* Hidden heading for accessibility + schema Question node */}
      <meta itemProp='name' content={question} />

      <div
        itemScope
        itemProp='mainEntity'
        itemType='https://schema.org/Question'
      >
        <h2
          id={cnCode ? `factbox-${cnCode}` : 'factbox-heading'}
          itemProp='name'
          className='text-base font-bold text-foreground mb-2'
        >
          {question}
        </h2>

        <div
          itemScope
          itemProp='acceptedAnswer'
          itemType='https://schema.org/Answer'
        >
          <p
            itemProp='text'
            className='text-sm text-foreground leading-relaxed'
          >
            {answer}
          </p>
        </div>
      </div>

      {/* Explicit citation with link — YMYL regulatory trust signal */}
      <cite className='block text-xs text-muted mt-3 not-italic'>
        Source:{' '}
        <a
          href={sourceUrl}
          target='_blank'
          rel='noopener noreferrer'
          className='text-accent underline underline-offset-2 hover:no-underline'
        >
          {sourceRegulation}
        </a>
      </cite>
    </section>
  );
}

/**
 * Pre-configured FactBox for 2026 transition: "Actual Data Required" CTA
 * Injects high-intent lead magnet below the fact.
 */
export function TransitionalPeriodFactBox({ cnCode, sector }: { cnCode: string; sector: string }) {
  return (
    <div className='bg-amber-50 border border-amber-200 rounded-lg p-4 my-6'>
      <p className='text-sm text-amber-900 font-semibold mb-2'>
        The CBAM transitional period ended 31 December 2025.
      </p>
      <p className='text-xs text-amber-800 leading-relaxed mb-3'>
        From 1 January 2026, EU importers must use{' '}
        <strong>actual installation data</strong> for CN code {cnCode}. Default
        values are no longer accepted as a substitute for verified emissions
        data under Regulation (EU) 2023/956.
      </p>
      <Link
        href={`/register?next=/cases/new&cn=${cnCode}&sector=${sector}`}
        className='inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-amber-700'
      >
        Prepare Your Actual-Data CBAM Dossier
      </Link>
    </div>
  );
}
