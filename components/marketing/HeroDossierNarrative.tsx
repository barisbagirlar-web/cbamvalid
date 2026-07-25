"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import styles from "./HeroDossierNarrative.module.css";
import { BrandMark } from "@/components/brand/BrandMark";

type Scene = "weak" | "strong";

const FIELDS_WEAK = [
  { label: "Goods scope", value: "Steel? / TBD", tone: "warn" as const },
  { label: "Embedded emissions", value: "~400 tCO₂e?", tone: "warn" as const },
  { label: "Evidence coverage", value: "4 / 16 linked", tone: "err" as const },
  { label: "QC blockers", value: "7 open", tone: "err" as const },
];

const FIELDS_STRONG = [
  { label: "Goods scope", value: "CN 7208 39 00", tone: "ok" as const },
  { label: "Embedded emissions", value: "412.60 tCO₂e", tone: "ok" as const },
  { label: "Evidence coverage", value: "16 / 16 supported", tone: "ok" as const },
  { label: "QC blockers", value: "0 open", tone: "ok" as const },
];

/** Full narrative length — must match CSS --cycle. */
const CYCLE_MS = 14_000;

function DossierCard({ scene }: { scene: Scene }) {
  const isStrong = scene === "strong";
  const fields = isStrong ? FIELDS_STRONG : FIELDS_WEAK;

  return (
    <div
      className={[
        styles.dossier,
        isStrong ? styles.dossierStrong : styles.dossierWeak,
        isStrong ? styles.cardStrong : styles.cardWeak,
      ].join(" ")}
    >
      <div className={styles.paperGrain} aria-hidden="true" />
      <div className={styles.frame} aria-hidden="true" />
      <div className={styles.scanline} aria-hidden="true" />

      <header className={styles.head}>
        <BrandMark className={styles.brandMark} tone="default" />
        <div className={styles.headCopy}>
          <b>Evidence Dossier</b>
          <span className={styles.status} data-tone={isStrong ? "ok" : "err"}>
            {isStrong ? "Sealed · v5" : "Blocked"}
          </span>
        </div>
      </header>

      <h3 className={styles.title}>
        CBAM Definitive-Period
        <br />
        <em>{isStrong ? "Verification Preparation Pack" : "Audit-Preparation Draft"}</em>
      </h3>

      <div className={styles.rows}>
        {fields.map((field, index) => (
          <div
            key={field.label}
            className={styles.row}
            data-tone={field.tone}
            style={{ ["--i" as string]: index }}
          >
            <b>{field.label}</b>
            <span className={styles.value}>{field.value}</span>
          </div>
        ))}
      </div>

      <footer className={styles.foot}>
        <span className={styles.hash}>
          {isStrong ? "SHA-256 · 9f2a…c41d · immutable" : "SHA-256 · — missing integrity chain"}
        </span>
        <div className={styles.miniMeter} aria-hidden="true">
          <span />
        </div>
      </footer>

      <div className={[styles.stamp, isStrong ? styles.stampOk : styles.stampErr].join(" ")}>
        <strong>{isStrong ? "Sealed" : "QC Blocked"}</strong>
        <span>{isStrong ? "Ready for independent verification" : "Not verification-ready"}</span>
        <div className={styles.stampRipple} />
      </div>

      {!isStrong ? <div className={styles.failVeil} aria-hidden="true" /> : null}
      {isStrong ? <div className={styles.successGlow} aria-hidden="true" /> : null}
    </div>
  );
}

/**
 * CSS-first hero narrative. Keyframes drive float, scan, fill, stamp, and crossfade.
 * Marker: HERO_CSS_MOTION_V2 — if JS caption swap fails, motion still runs.
 */
export function HeroDossierNarrative() {
  const [captionScene, setCaptionScene] = useState<Scene>("weak");
  const [reducedMotion, setReducedMotion] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const stage3dRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(media.matches);
    apply();
    media.addEventListener("change", apply);

    if (media.matches) {
      setCaptionScene("strong");
      return () => media.removeEventListener("change", apply);
    }

    const started = performance.now();
    const id = window.setInterval(() => {
      const cycle01 = ((performance.now() - started) % CYCLE_MS) / CYCLE_MS;
      setCaptionScene(cycle01 < 0.48 ? "weak" : "strong");
    }, 200);

    return () => {
      media.removeEventListener("change", apply);
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    let raf = 0;
    const tick = () => {
      const el = stage3dRef.current;
      if (el) {
        const { x, y } = tiltRef.current;
        el.style.setProperty("--tilt-x", `${6 + x}deg`);
        el.style.setProperty("--tilt-y", `${-8 + y}deg`);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (reducedMotion || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    tiltRef.current = { x: py * -6, y: px * 8 };
  };

  const onPointerLeave = () => {
    tiltRef.current = { x: 0, y: 0 };
  };

  const caption =
    captionScene === "strong"
      ? {
          eyebrow: "Prepared with CBAMValid",
          title: "Evidence-linked. Deterministic. Sealed.",
          detail: "Operator-prepared package, ready for independent accredited verification.",
        }
      : {
          eyebrow: "Ad-hoc preparation",
          title: "Incomplete inputs. Unlinked evidence.",
          detail: "A dossier assembled outside a controlled workflow fails closed quality controls.",
        };

  return (
    <div
      ref={rootRef}
      className={[styles.stage, reducedMotion ? styles.reduced : styles.motionOn].join(" ")}
      data-hero-motion="HERO_CSS_MOTION_V2"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      role="img"
      aria-label="Animated comparison: an unmanaged CBAM dossier fails quality control, then a CBAMValid-prepared dossier is sealed and ready for independent verification."
    >
      <div className={styles.ambient} data-scene={captionScene} aria-hidden="true" />
      <div className={styles.orbit} aria-hidden="true" />

      <div className={styles.caption}>
        <span className={styles.captionEyebrow} data-scene={captionScene}>
          {caption.eyebrow}
        </span>
        <p className={styles.captionTitle}>{caption.title}</p>
        <p className={styles.captionDetail}>{caption.detail}</p>
      </div>

      <div className={styles.timeline} aria-hidden="true">
        <span className={styles.timelineFill} />
        <div className={styles.timelineLabels}>
          <span className={captionScene === "weak" ? styles.tlActive : undefined}>Fail path</span>
          <span className={captionScene === "strong" ? styles.tlActive : undefined}>Seal path</span>
        </div>
      </div>

      <div ref={stage3dRef} className={styles.stage3d}>
        <div className={styles.floatLayer}>
          <div className={styles.cardStack}>
            <DossierCard scene="weak" />
            <DossierCard scene="strong" />
          </div>
        </div>
      </div>

      <div className={styles.legend} aria-hidden="true">
        <span>
          <i className={styles.legendWeak} /> Unmanaged prep
        </span>
        <span>
          <i className={styles.legendStrong} /> CBAMValid seal path
        </span>
      </div>
    </div>
  );
}
