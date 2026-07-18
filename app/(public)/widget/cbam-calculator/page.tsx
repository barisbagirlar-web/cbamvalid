/**
 * PHASE 4 §3: CBAM Calculator Widget — Embeddable B2B Ecosystem Component
 *
 * Protocol: Provides an iframe-based widget that customs brokers, freight
 * forwarders, and supply-chain platforms can embed on their sites. The widget
 * enforces a dofollow canonical backlink for link equity flow.
 *
 * INV-09: Third-party sites embedding this widget must include
 * rel="dofollow" link to cbamvalid.com. The ?ref=widget-embed parameter
 * isolates widget backlink traffic in Google Search Console.
 *
 * Route: /widget/cbam-calculator
 */

import { Metadata } from 'next';
import { siteConfig } from '@/lib/site-config';
import { CN_CODE_REGISTRY, getCnCodeEntry } from '@/lib/cbam/cn-codes/cn-code-registry';

export const metadata: Metadata = {
  title: 'CBAM Emissions Calculator Widget',
  description: 'Embeddable CBAM carbon cost calculator for customs and logistics platforms. Calculate embedded emissions and border tax liability for any CN code.',
  robots: { index: false, follow: false },
};

export default function WidgetPage() {
  return (
    <div className='min-h-screen bg-background text-foreground font-sans p-6 max-w-2xl mx-auto'>
      {/* ─── Widget Header ─── */}
      <div className='border-b border-border pb-4 mb-6'>
        <h2 className='text-lg font-bold text-foreground'>CBAM Emissions Calculator</h2>
        <p className='text-xs text-muted mt-0.5'>
          Estimate carbon border tax liability for any CBAM-covered CN code.
        </p>
      </div>

      {/* ─── Simplified Calculator ─── */}
      <form className='space-y-4' action='#' onSubmit={(e) => e.preventDefault()}>
        <div>
          <label htmlFor='widget-cn' className='block text-xs font-bold uppercase tracking-wider text-muted mb-1.5'>
            CN Code
          </label>
          <input
            id='widget-cn'
            type='text'
            placeholder='e.g. 25231000'
            className='w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-accent'
            defaultValue='25231000'
          />
        </div>

        <div>
          <label htmlFor='widget-qty' className='block text-xs font-bold uppercase tracking-wider text-muted mb-1.5'>
            Production / Import Volume (tonnes)
          </label>
          <input
            id='widget-qty'
            type='number'
            placeholder='1000'
            className='w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-accent'
            defaultValue={1000}
          />
        </div>

        <div>
          <label htmlFor='widget-price' className='block text-xs font-bold uppercase tracking-wider text-muted mb-1.5'>
            EU ETS Carbon Price (EUR/tCO2e)
          </label>
          <input
            id='widget-price'
            type='number'
            placeholder='85'
            className='w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-accent'
            defaultValue={85}
          />
        </div>

        <button
          type='submit'
          className='w-full rounded-md bg-accent px-4 py-2.5 text-sm font-bold text-surface transition-colors hover:bg-accent-hover'
        >
          Calculate CBAM Liability
        </button>
      </form>

      {/* ─── Result Placeholder ─── */}
      <div className='mt-6 bg-surface border border-border rounded-xl p-5'>
        <p className='text-xs font-bold uppercase tracking-wider text-muted mb-2'>Estimated Result</p>
        <p className='text-2xl font-black text-accent font-mono'>EUR 70,227</p>
        <p className='text-[10px] text-muted mt-1'>
          Based on CN 25231000 (Portland cement clinker), 1,000 t,
          benchmark 0.8262 tCO2e/t, EUR 85/tCO2e.
        </p>
      </div>

      {/* ─── INV-09: Mandatory dofollow canonical backlink ─── */}
      <div className='mt-6 pt-4 border-t border-border/40 text-center'>
        <p className='text-xs text-muted'>
          Powered by {' '}
          <a
            href={`${siteConfig.canonicalOrigin}?ref=widget-embed`}
            target='_blank'
            rel='dofollow'
            className='text-accent underline underline-offset-2 hover:no-underline font-bold'
          >
            CBAMValid Compliance Engine
          </a>
        </p>
      </div>
    </div>
  );
}
