import { generateSeoMetadata } from "@/lib/seo/build-metadata";

export const metadata = generateSeoMetadata("/developers");

const hash = "<64-character-sha256>";

export default function DevelopersPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12 md:py-16">
      <p className="text-sm font-semibold uppercase tracking-wide text-accent">Public API v1</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Verify sealed dossier integrity by SHA-256</h1>
      <p className="mt-5 max-w-3xl text-muted">
        The endpoint returns only integrity and release metadata. It does not expose case inputs, customer identity, evidence files or calculation detail. Requests are rate-limited and responses are CDN-cacheable for five minutes.
      </p>
      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold">Endpoint</h2>
        <pre className="overflow-x-auto rounded-lg border border-border bg-surface p-4 text-sm"><code>GET /api/v1/verify/{hash}</code></pre>
        <a className="text-accent underline" href="/openapi.yaml">OpenAPI 3.1 specification</a>
      </section>
      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Examples</h2>
        <pre className="overflow-x-auto rounded-lg border border-border bg-surface p-4 text-sm"><code>{`curl https://cbamvalid.com/api/v1/verify/${hash}`}</code></pre>
        <pre className="overflow-x-auto rounded-lg border border-border bg-surface p-4 text-sm"><code>{`import requests\nprint(requests.get("https://cbamvalid.com/api/v1/verify/${hash}").json())`}</code></pre>
        <pre className="overflow-x-auto rounded-lg border border-border bg-surface p-4 text-sm"><code>{`const result = await fetch("https://cbamvalid.com/api/v1/verify/${hash}").then(r => r.json());`}</code></pre>
      </section>
      <section className="mt-8 rounded-lg border border-border bg-surface p-5 text-sm text-muted">
        A valid registry match confirms that CBAMValid has a sealed report record for the supplied document hash. It is not an accredited verification opinion or a regulatory filing status.
      </section>
    </main>
  );
}
