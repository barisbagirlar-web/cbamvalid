"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import styles from "./HeroDossierNarrative.module.css";

/**
 * Single-clock cinematic hero (rAF). No fragile setTimeout chains.
 * Continuous micro-motion + staged narrative beats.
 */

type Scene = "weak" | "strong";

type FieldSpec = {
  label: string;
  weak: string;
  strong: string;
};

const FIELDS: FieldSpec[] = [
  { label: "Goods scope", weak: "Steel? / TBD", strong: "CN 7208 39 00" },
  { label: "Embedded emissions", weak: "~400 tCO₂e?", strong: "412.60 tCO₂e" },
  { label: "Evidence coverage", weak: "4 / 16 linked", strong: "16 / 16 supported" },
  { label: "QC blockers", weak: "7 open", strong: "0 open" },
];

const LOOP_MS = 18_000;
const WEAK_END = 8_200;
const CROSSFADE_MS = 700;

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function typeProgress(elapsedInScene: number, index: number, scene: Scene) {
  const start = 380 + index * (scene === "weak" ? 480 : 420);
  const duration = scene === "weak" ? 520 : 460;
  return clamp01((elapsedInScene - start) / duration);
}

function scrambleReveal(target: string, progress: number, seed: number) {
  if (progress <= 0) return "";
  if (progress >= 1) return target;
  const glyphs = "0123456789ABCDEF·/?~";
  const count = Math.floor(target.length * easeOutCubic(progress));
  let out = "";
  for (let i = 0; i < count; i += 1) {
    if (progress > 0.72 || i < count - 1) {
      out += target[i];
    } else {
      out += glyphs[(i * 7 + seed * 3) % glyphs.length];
    }
  }
  return out;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return reduced;
}

function BrandMark({ pulse }: { pulse: boolean }) {
  return (
    <svg
      className={[styles.brandMark, pulse ? styles.brandPulse : ""].join(" ")}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20 3 35 9.5v9.7c0 8.9-6.2 15-15 17.8C11.2 34.2 5 28.1 5 19.2V9.5L20 3Z"
        stroke="#C0562F"
        strokeWidth="2.6"
        fill="#F5E4D8"
      />
      <path
        d="m13.5 20.2 4.3 4.3 8.7-9"
        stroke="#C0562F"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function deriveFrame(clock: number) {
  const inCrossToStrong = clock >= WEAK_END && clock < WEAK_END + CROSSFADE_MS;
  const inCrossToWeak = clock >= LOOP_MS - CROSSFADE_MS;
  const scene: Scene = clock < WEAK_END + CROSSFADE_MS / 2 ? "weak" : "strong";
  const sceneElapsed = scene === "weak" ? clock : Math.max(0, clock - (WEAK_END + CROSSFADE_MS));
  const crossfade = inCrossToStrong || inCrossToWeak
    ? clamp01(
        inCrossToStrong
          ? (clock - WEAK_END) / CROSSFADE_MS
          : (clock - (LOOP_MS - CROSSFADE_MS)) / CROSSFADE_MS
      )
    : 0;

  const stampAt = scene === "weak" ? 5600 : 5200;
  const stampProgress = clamp01((sceneElapsed - stampAt) / 520);
  const stampActive = stampProgress > 0.08;
  const stampImpact = easeOutBack(clamp01(stampProgress * 1.15));

  const reviewAt = scene === "weak" ? 4800 : 4400;
  const scanning = sceneElapsed > reviewAt - 400 && sceneElapsed < stampAt + 200;

  const hashProgress =
    scene === "strong" ? clamp01((sceneElapsed - 3600) / 900) : clamp01((sceneElapsed - 4200) / 600);

  const rows = FIELDS.map((field, index) => {
    const progress = typeProgress(sceneElapsed, index, scene);
    const value = scene === "weak" ? field.weak : field.strong;
    const shown = scrambleReveal(value, progress, index + (scene === "strong" ? 11 : 3));
    const tone =
      scene === "weak"
        ? index < 2
          ? "warn"
          : "err"
        : "ok";
    return {
      label: field.label,
      shown,
      complete: progress >= 1,
      visible: progress > 0.02,
      progress,
      tone,
      caret: progress > 0.02 && progress < 1,
    };
  });

  const caption =
    scene === "weak"
      ? {
          eyebrow: "Ad-hoc preparation",
          title: "Incomplete inputs. Unlinked evidence.",
          detail: "A dossier assembled outside a controlled workflow fails closed quality controls.",
        }
      : {
          eyebrow: "Prepared with CBAMValid",
          title: "Evidence-linked. Deterministic. Sealed.",
          detail: "Operator-prepared package, ready for independent accredited verification.",
        };

  const stamp =
    scene === "weak"
      ? { line1: "QC Blocked", line2: "Not verification-ready" }
      : { line1: "Sealed", line2: "Ready for independent verification" };

  const status =
    stampActive
      ? scene === "weak"
        ? "Blocked"
        : "Sealed · v5"
      : scanning
        ? scene === "weak"
          ? "Review failed"
          : "Integrity check"
        : scene === "weak"
          ? "Draft · unmanaged"
          : "Guided preparation";

  const fillRatio = rows.reduce((sum, row) => sum + row.progress, 0) / rows.length;

  return {
    scene,
    crossfade,
    stampActive,
    stampImpact,
    scanning,
    hashProgress,
    rows,
    caption,
    stamp,
    status,
    fillRatio,
    sceneElapsed,
  };
}

export function HeroDossierNarrative() {
  const reducedMotion = usePrefersReducedMotion();
  const [clock, setClock] = useState(1200);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (reducedMotion || !ready) return;
    let raf = 0;
    const start = performance.now() - 1200;
    const tick = (now: number) => {
      setClock((now - start) % LOOP_MS);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion, ready]);

  const frame = useMemo(
    () => (reducedMotion ? deriveFrame(WEAK_END + CROSSFADE_MS + 7000) : deriveFrame(clock)),
    [clock, reducedMotion]
  );

  const hashText =
    frame.scene === "strong"
      ? "SHA-256 · 9f2a…c41d · immutable"
      : "SHA-256 · — missing integrity chain";

  return (
    <div
      className={[
        styles.stage,
        styles[`scene_${frame.scene}`],
        frame.crossfade > 0.05 ? styles.crossfading : "",
        frame.stampActive ? styles.stamped : "",
        frame.scanning ? styles.scanning : "",
        reducedMotion ? styles.reduced : "",
        ready ? styles.live : "",
      ].join(" ")}
      style={
        {
          "--fill": String(frame.fillRatio),
          "--stamp": String(frame.stampImpact),
          "--cross": String(frame.crossfade),
          "--hash": String(frame.hashProgress),
        } as CSSProperties
      }
      role="img"
      aria-label="Animated comparison: an unmanaged CBAM dossier fails quality control, then a CBAMValid-prepared dossier is sealed and ready for independent verification."
    >
      <div className={styles.orbit} aria-hidden="true" />
      <div className={styles.orbitSecondary} aria-hidden="true" />
      <div className={styles.grain} aria-hidden="true" />

      <div className={styles.caption}>
        <span className={styles.captionEyebrow}>{frame.caption.eyebrow}</span>
        <p className={styles.captionTitle}>{frame.caption.title}</p>
        <p className={styles.captionDetail}>{frame.caption.detail}</p>
      </div>

      <div className={styles.dossierFloat}>
      <div className={styles.dossier}>
        <div className={styles.sheen} aria-hidden="true" />
        <div className={styles.scanBeam} aria-hidden="true" />
        <div className={styles.frame} aria-hidden="true" />

        <header className={styles.head}>
          <BrandMark pulse={frame.scene === "strong" && frame.stampActive} />
          <div className={styles.headCopy}>
            <b>Evidence Dossier</b>
            <span
              className={styles.status}
              data-tone={
                frame.stampActive
                  ? frame.scene === "strong"
                    ? "ok"
                    : "err"
                  : "neutral"
              }
            >
              <i className={styles.statusDot} />
              {frame.status}
            </span>
          </div>
        </header>

        <h3 className={styles.title}>
          CBAM Definitive-Period
          <br />
          <em>
            {frame.scene === "strong"
              ? "Verification Preparation Pack"
              : "Audit-Preparation Draft"}
          </em>
        </h3>

        <div className={styles.meter} aria-hidden="true">
          <span className={styles.meterFill} />
        </div>

        <div className={styles.rows}>
          {frame.rows.map((row) => (
            <div
              key={row.label}
              className={[styles.row, row.visible ? styles.rowIn : ""].join(" ")}
              data-tone={row.tone}
              style={{ ["--row" as string]: String(row.progress) }}
            >
              <b>{row.label}</b>
              <span className={styles.value}>
                {row.shown}
                {row.caret ? <i className={styles.caret} /> : null}
              </span>
              <span className={styles.rowGlow} aria-hidden="true" />
            </div>
          ))}
        </div>

        <footer className={styles.foot}>
          <span className={styles.hash}>{hashText}</span>
          <div className={styles.progress} aria-hidden="true">
            <span className={frame.scene === "weak" ? styles.dotActive : styles.dot} />
            <span className={frame.scene === "strong" ? styles.dotActive : styles.dot} />
          </div>
        </footer>

        <div
          className={[
            styles.stamp,
            frame.stampActive ? styles.stampIn : "",
            frame.scene === "strong" ? styles.stampOk : styles.stampErr,
          ].join(" ")}
          aria-hidden={!frame.stampActive}
        >
          <span className={styles.stampRing} aria-hidden="true" />
          <span className={styles.stampRingDelay} aria-hidden="true" />
          <strong>{frame.stamp.line1}</strong>
          <span>{frame.stamp.line2}</span>
        </div>
      </div>
      </div>

      <div className={styles.timeline} aria-hidden="true">
        <span className={styles.timelineTrack}>
          <i className={styles.timelinePlayhead} style={{ left: `${(clock / LOOP_MS) * 100}%` }} />
        </span>
        <div className={styles.legend}>
          <span>
            <i className={styles.legendWeak} /> Unmanaged prep
          </span>
          <span>
            <i className={styles.legendStrong} /> CBAMValid seal path
          </span>
        </div>
      </div>
    </div>
  );
}
