import { permanentRedirect } from "next/navigation";

/**
 * Consolidated into /methodology (canonical authority page).
 * Kept as an App Router redirect so any residual internal/external hit lands correctly
 * even if CDN/config redirect order differs.
 */
export default function LegacyCbamMethodologyPage() {
  permanentRedirect("/methodology");
}
