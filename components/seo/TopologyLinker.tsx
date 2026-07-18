/**
 * PHASE 4 §1: TopologyLinker — Deterministic Hub-Spoke Internal Link Graph
 *
 * Protocol: Every CN code page (Spoke) must link to its Sector Hub and
 * to related CN codes within the same sector. Every Sector Hub must link
 * to its top CN codes. This creates a crawlable graph topology that
 * eliminates orphan pages and maximizes PageRank flow.
 *
 * INV-08: Manual internal linking is forbidden. All links are generated
 * deterministically from the CN_CODE_REGISTRY taxonomy via graph traversal.
 */

import Link from 'next/link';
import { CnCodeEntry } from '@/lib/cbam/cn-codes/cn-code-registry';

const SECTOR_DISPLAY: Record<string, string> = {
  cement: 'Cement',
  steel: 'Iron and Steel',
  aluminium: 'Aluminium',
  fertilisers: 'Fertilisers',
  hydrogen: 'Hydrogen',
  electricity: 'Electricity',
  downstream: 'Downstream Complex Goods',
};

interface TopologyLinkerProps {
  /** Current CN code being viewed (the Spoke) */
  currentCode: string;
  /** Sector slug for Hub link */
  sectorSlug: string;
  /** Up to 12 related CN codes in the same sector (sorted by code, excluding current) */
  relatedCodes: CnCodeEntry[];
}

export function TopologyLinker({ currentCode, sectorSlug, relatedCodes }: TopologyLinkerProps) {
  const sectorLabel = SECTOR_DISPLAY[sectorSlug] ?? sectorSlug;
  const displayCodes = relatedCodes.slice(0, 12);

  return (
    <nav
      aria-label={`CBAM ${sectorLabel} CN Code Taxonomy`}
      className='border-t border-border mt-12 pt-8'
    >
      {/* ─── Hub Link (Back to Sector) ─── */}
      <div className='mb-6'>
        <Link
          href={`/sectors/${sectorSlug}`}
          className='inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline underline-offset-2'
        >
          ← {sectorLabel} Sector Hub — CBAM Guidelines &amp; Benchmarks
        </Link>
      </div>

      {/* ─── Spoke Grid (Related CN Codes) ─── */}
      {displayCodes.length > 0 && (
        <>
          <h2 className='text-lg font-bold mb-4'>
            {sectorLabel} Sector CN Codes
          </h2>
          <ul className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
            {displayCodes.map((entry) => (
              <li key={entry.code}>
                <Link
                  href={`/cn-codes/${entry.code}`}
                  className='block p-3 bg-surface border border-border rounded-lg hover:border-accent/40 transition-colors text-sm'
                >
                  <span className='font-mono text-accent font-bold'>{entry.code}</span>
                  <span className='block text-xs text-muted mt-1 line-clamp-2'>
                    {entry.description}
                  </span>
                  {entry.benchmarkTco2ePerTonne !== null && (
                    <span className='block text-xs text-muted mt-1 font-mono'>
                      {entry.benchmarkTco2ePerTonne} tCO2e/t
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* ─── Cross-Silo Links (Other Sectors) ─── */}
      <div className='mt-6 pt-6 border-t border-border/40'>
        <h3 className='text-sm font-bold uppercase tracking-wider text-muted mb-3'>
          Explore Other CBAM Sectors
        </h3>
        <div className='flex flex-wrap gap-2'>
          {Object.entries(SECTOR_DISPLAY).map(([slug, label]) =>
            slug !== sectorSlug ? (
              <Link
                key={slug}
                href={`/sectors/${slug}`}
                className='inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-accent/40 hover:text-foreground'
              >
                {label}
              </Link>
            ) : null
          )}
        </div>
      </div>
    </nav>
  );
}
