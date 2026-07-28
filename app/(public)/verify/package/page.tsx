import type { Metadata } from "next";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";

export const metadata: Metadata = generateSeoMetadata("/verify/package");

export default function VerifyPackageIndexPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Verify sealed package</h1>
      <p className="mt-4 text-muted">
        Open <code className="mono">/verify/package/&lt;packageId&gt;</code> or call{" "}
        <code className="mono">/api/verify/package/&lt;packageId&gt;</code> to inspect seal
        integrity metadata. This surface does not issue an accredited verification opinion.
      </p>
    </main>
  );
}
