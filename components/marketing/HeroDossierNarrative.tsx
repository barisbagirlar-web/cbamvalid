"use client";

import { useEffect, useState } from "react";
import "./hero-story.css";

/**
 * 5-second attention story:
 * Unmanaged dossier → QC Blocked
 * CBAMValid path → Sealed (ready for independent verification)
 *
 * CSS keyframes live in a non-module stylesheet so animation names
 * cannot be broken by hashing / silent paint failures.
 */
export function HeroDossierNarrative() {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (reduce) {
    return (
      <div
        className="hs"
        data-hero-motion="HERO_STORY_5S"
        data-mode="static"
        role="img"
        aria-label="Comparison: unmanaged CBAM dossier is QC blocked; CBAMValid-prepared dossier is sealed and ready for independent verification."
      >
        <div className="hs-static">
          <Panel tone="fail" stamped />
          <Panel tone="pass" stamped />
        </div>
        <p className="hs-tagline">
          Same evidence problem. Two outcomes. Only one is verification-ready.
        </p>
      </div>
    );
  }

  return (
    <div
      className="hs hs-motion"
      data-hero-motion="HERO_STORY_5S"
      data-mode="motion"
      role="img"
      aria-label="Animated comparison: unmanaged CBAM dossier fails quality control, then a CBAMValid-prepared dossier is sealed for independent verification."
    >
      <div className="hs-stage">
        <div className="hs-beam" aria-hidden="true" />
        <div className="hs-card hs-card-fail" aria-hidden="true">
          <Panel tone="fail" stamped />
        </div>
        <div className="hs-card hs-card-pass" aria-hidden="true">
          <Panel tone="pass" stamped />
        </div>
        <div className="hs-stamp-layer" aria-hidden="true">
          <div className="hs-slam hs-slam-fail">
            <strong>QC Blocked</strong>
            <span>Not verification-ready</span>
          </div>
          <div className="hs-slam hs-slam-pass">
            <strong>Sealed</strong>
            <span>Ready for independent verification</span>
          </div>
        </div>
      </div>

      <div className="hs-caption" aria-hidden="true">
        <span className="hs-cap hs-cap-fail">Ad-hoc prep fails closed QC</span>
        <span className="hs-cap hs-cap-pass">CBAMValid seals a verifier-ready pack</span>
      </div>

      <div className="hs-progress" aria-hidden="true">
        <i />
      </div>
    </div>
  );
}

function Panel({ tone, stamped }: { tone: "fail" | "pass"; stamped?: boolean }) {
  const fail = tone === "fail";
  return (
    <article className={`hs-panel ${fail ? "is-fail" : "is-pass"} ${stamped ? "is-stamped" : ""}`}>
      <header className="hs-panel-head">
        <b>Evidence Dossier</b>
        <em>{fail ? "Unmanaged" : "CBAMValid"}</em>
      </header>
      <h3>
        {fail ? "Audit-preparation draft" : "Verification Preparation Pack"}
      </h3>
      <ul className="hs-rows">
        <li className={fail ? "bad" : "ok"}>
          <span>Goods scope</span>
          <b>{fail ? "Steel? / TBD" : "CN 7208 39 00"}</b>
        </li>
        <li className={fail ? "bad" : "ok"}>
          <span>Embedded emissions</span>
          <b>{fail ? "~400 tCO₂e?" : "412.60 tCO₂e"}</b>
        </li>
        <li className={fail ? "bad" : "ok"}>
          <span>Evidence coverage</span>
          <b>{fail ? "4 / 16 linked" : "16 / 16 supported"}</b>
        </li>
        <li className={fail ? "bad" : "ok"}>
          <span>QC blockers</span>
          <b>{fail ? "7 open" : "0 open"}</b>
        </li>
      </ul>
      <footer>
        {fail ? "SHA-256 · missing integrity chain" : "SHA-256 · 9f2a…c41d · immutable"}
      </footer>
    </article>
  );
}
