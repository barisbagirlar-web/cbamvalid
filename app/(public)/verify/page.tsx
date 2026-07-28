import { Suspense } from "react";
import VerifyPageClient from "./VerifyPageClient";

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <main id="main">
          <section className="section">
            <div className="wrap">
              <div className="section-head center" style={{ marginBottom: "40px" }}>
                <span className="eyebrow">Public Integrity Check</span>
                <h1>Verify a dossier</h1>
                <p>Enter a document hash to confirm integrity.</p>
              </div>
            </div>
          </section>
        </main>
      }
    >
      <VerifyPageClient />
    </Suspense>
  );
}
