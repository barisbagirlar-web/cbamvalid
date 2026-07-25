"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./HeroDossierNarrative.module.css";

type Scene = "weak" | "strong";
type Phase =
  | "boot"
  | "fill"
  | "review"
  | "stamp"
  | "hold"
  | "crossfade";

type FieldSpec = {
  label: string;
  weak: string;
  strong: string;
  weakTone?: "warn" | "err" | "muted";
  strongTone?: "ok" | "muted";
};

const FIELDS: FieldSpec[] = [
  {
    label: "Goods scope",
    weak: "Steel? / TBD",
    strong: "CN 7208 39 00",
    weakTone: "warn",
    strongTone: "ok",
  },
  {
    label: "Embedded emissions",
    weak: "~400 tCO₂e?",
    strong: "412.60 tCO₂e",
    weakTone: "warn",
    strongTone: "ok",
  },
  {
    label: "Evidence coverage",
    weak: "4 / 16 linked",
    strong: "16 / 16 supported",
    weakTone: "err",
    strongTone: "ok",
  },
  {
    label: "QC blockers",
    weak: "7 open",
    strong: "0 open",
    weakTone: "err",
    strongTone: "ok",
  },
];

const CAPTIONS: Record<Scene, { eyebrow: string; title: string; detail: string }> = {
  weak: {
    eyebrow: "Ad-hoc preparation",
    title: "Incomplete inputs. Unlinked evidence.",
    detail: "A dossier assembled outside a controlled workflow fails closed quality controls.",
  },
  strong: {
    eyebrow: "Prepared with CBAMValid",
    title: "Evidence-linked. Deterministic. Sealed.",
    detail: "Operator-prepared package, ready for independent accredited verification.",
  },
};

const STAMPS: Record<Scene, { line1: string; line2: string }> = {
  weak: { line1: "QC Blocked", line2: "Not verification-ready" },
  strong: { line1: "Sealed", line2: "Ready for independent verification" },
};

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

function BrandMark() {
  return (
    <svg className={styles.brandMark} viewBox="0 0 40 40" fill="none" aria-hidden="true">
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

type NarrativeViewProps = {
  scene: Scene;
  phase: Phase;
  visibleRows: number;
  typedChars: number[];
  stampActive: boolean;
  hashReveal: number;
  reducedMotion?: boolean;
};

function NarrativeView({
  scene,
  phase,
  visibleRows,
  typedChars,
  stampActive,
  hashReveal,
  reducedMotion = false,
}: NarrativeViewProps) {
  const caption = CAPTIONS[scene];
  const stamp = STAMPS[scene];
  const hashFull =
    scene === "strong"
      ? "SHA-256 · 9f2a…c41d · immutable"
      : "SHA-256 · — missing integrity chain";

  const statusLabel = useMemo(() => {
    if (scene === "weak") {
      if (phase === "stamp" || phase === "hold") return "Blocked";
      if (phase === "review") return "Review failed";
      return "Draft · unmanaged";
    }
    if (phase === "stamp" || phase === "hold") return "Sealed · v5";
    if (phase === "review") return "Integrity check";
    return "Guided preparation";
  }, [phase, scene]);

  return (
    <div
      className={[
        styles.stage,
        styles[`scene_${scene}`],
        styles[`phase_${phase}`],
        reducedMotion ? styles.reduced : "",
      ].join(" ")}
      role="img"
      aria-label="Animated comparison: an unmanaged CBAM dossier fails quality control, then a CBAMValid-prepared dossier is sealed and ready for independent verification."
    >
      <div className={styles.ambient} aria-hidden="true" />
      <div className={styles.caption}>
        <span className={styles.captionEyebrow}>{caption.eyebrow}</span>
        <p className={styles.captionTitle}>{caption.title}</p>
        <p className={styles.captionDetail}>{caption.detail}</p>
      </div>

      <div className={styles.dossier}>
        <div className={styles.frame} aria-hidden="true" />
        <header className={styles.head}>
          <BrandMark />
          <div className={styles.headCopy}>
            <b>Evidence Dossier</b>
            <span
              className={styles.status}
              data-tone={
                scene === "strong" && stampActive
                  ? "ok"
                  : scene === "weak" && stampActive
                    ? "err"
                    : "neutral"
              }
            >
              {statusLabel}
            </span>
          </div>
        </header>

        <h3 className={styles.title}>
          CBAM Definitive-Period
          <br />
          <em>{scene === "strong" ? "Verification Preparation Pack" : "Audit-Preparation Draft"}</em>
        </h3>

        <div className={styles.rows}>
          {FIELDS.map((field, index) => {
            const value = scene === "weak" ? field.weak : field.strong;
            const shown = value.slice(0, typedChars[index] || 0);
            const visible = index < visibleRows;
            const tone = scene === "weak" ? field.weakTone : field.strongTone;
            return (
              <div
                key={field.label}
                className={[styles.row, visible ? styles.rowIn : ""].join(" ")}
                data-tone={tone}
                style={{ transitionDelay: `${index * 40}ms` }}
              >
                <b>{field.label}</b>
                <span className={styles.value}>
                  {shown}
                  {visible && shown.length < value.length ? <i className={styles.caret} /> : null}
                </span>
              </div>
            );
          })}
        </div>

        <footer className={styles.foot}>
          <span
            className={styles.hash}
            style={{ opacity: scene === "strong" ? 0.35 + hashReveal * 0.65 : 0.55 }}
          >
            {hashFull}
          </span>
          <div className={styles.progress} aria-hidden="true">
            <span className={scene === "weak" ? styles.dotActive : styles.dot} />
            <span className={scene === "strong" ? styles.dotActive : styles.dot} />
          </div>
        </footer>

        <div
          className={[
            styles.stamp,
            stampActive ? styles.stampIn : "",
            scene === "strong" ? styles.stampOk : styles.stampErr,
          ].join(" ")}
          aria-hidden={!stampActive}
        >
          <strong>{stamp.line1}</strong>
          <span>{stamp.line2}</span>
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

/**
 * Cinematic hero narrative: ad-hoc dossier fails QC, then CBAMValid seals
 * a verification-ready package. Apple-style pacing — one focus, deliberate motion.
 */
export function HeroDossierNarrative() {
  const reducedMotion = usePrefersReducedMotion();
  const [scene, setScene] = useState<Scene>("weak");
  const [phase, setPhase] = useState<Phase>("boot");
  const [visibleRows, setVisibleRows] = useState(0);
  const [typedChars, setTypedChars] = useState<number[]>(() => FIELDS.map(() => 0));
  const [stampActive, setStampActive] = useState(false);
  const [hashReveal, setHashReveal] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (reducedMotion) return;

    const clearTimers = () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    };

    const later = (ms: number, fn: () => void) => {
      const id = window.setTimeout(fn, ms);
      timers.current.push(id);
    };

    const resetScene = (next: Scene) => {
      setScene(next);
      setPhase("boot");
      setVisibleRows(0);
      setTypedChars(FIELDS.map(() => 0));
      setStampActive(false);
      setHashReveal(0);
    };

    let cancelled = false;

    const runWeak = () => {
      if (cancelled) return;
      resetScene("weak");
      later(420, () => {
        if (cancelled) return;
        setPhase("fill");
        FIELDS.forEach((field, index) => {
          later(380 + index * 520, () => {
            if (cancelled) return;
            setVisibleRows(index + 1);
            const target = field.weak.length;
            let cursor = 0;
            const tick = () => {
              if (cancelled) return;
              cursor += 1;
              setTypedChars((prev) => {
                const next = [...prev];
                next[index] = Math.min(cursor, target);
                return next;
              });
              if (cursor < target) later(22 + (index % 2) * 8, tick);
            };
            tick();
          });
        });
        later(380 + FIELDS.length * 520 + 700, () => {
          if (cancelled) return;
          setPhase("review");
          later(900, () => {
            if (cancelled) return;
            setPhase("stamp");
            setStampActive(true);
            later(1600, () => {
              if (cancelled) return;
              setPhase("hold");
              later(1800, () => {
                if (cancelled) return;
                setPhase("crossfade");
                later(700, runStrong);
              });
            });
          });
        });
      });
    };

    const runStrong = () => {
      if (cancelled) return;
      resetScene("strong");
      later(480, () => {
        if (cancelled) return;
        setPhase("fill");
        FIELDS.forEach((field, index) => {
          later(320 + index * 480, () => {
            if (cancelled) return;
            setVisibleRows(index + 1);
            const target = field.strong.length;
            let cursor = 0;
            const tick = () => {
              if (cancelled) return;
              cursor += 1;
              setTypedChars((prev) => {
                const next = [...prev];
                next[index] = Math.min(cursor, target);
                return next;
              });
              if (cursor < target) later(18, tick);
            };
            tick();
          });
        });
        later(320 + FIELDS.length * 480 + 400, () => {
          if (cancelled) return;
          setHashReveal(1);
          setPhase("review");
          later(1000, () => {
            if (cancelled) return;
            setPhase("stamp");
            setStampActive(true);
            later(1800, () => {
              if (cancelled) return;
              setPhase("hold");
              later(3200, () => {
                if (cancelled) return;
                setPhase("crossfade");
                later(800, runWeak);
              });
            });
          });
        });
      });
    };

    // Defer first beat so the effect only schedules external timers (no sync setState).
    later(0, runWeak);

    return () => {
      cancelled = true;
      clearTimers();
    };
  }, [reducedMotion]);

  if (reducedMotion) {
    return (
      <NarrativeView
        scene="strong"
        phase="hold"
        visibleRows={FIELDS.length}
        typedChars={FIELDS.map((field) => field.strong.length)}
        stampActive
        hashReveal={1}
        reducedMotion
      />
    );
  }

  return (
    <NarrativeView
      scene={scene}
      phase={phase}
      visibleRows={visibleRows}
      typedChars={typedChars}
      stampActive={stampActive}
      hashReveal={hashReveal}
    />
  );
}
