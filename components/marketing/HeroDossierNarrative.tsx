"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import styles from "./HeroDossierNarrative.module.css";
import { BrandMark } from "@/components/brand/BrandMark";

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

const CYCLE_MS = 18_000;

type Beat = {
  fill: number;
  typeProgress: number;
  stamp: number;
  hash: number;
  scan: number;
  crossfade: number;
  captionPulse: number;
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function sampleBeat(cycle01: number): Beat {
  const t = cycle01 * CYCLE_MS;

  if (t < 7800) {
    const local = t;
    return {
      fill: smoothstep(500, 4200, local),
      typeProgress: clamp01(((local - 500) % 900) / 900),
      stamp: local > 6500 ? 1 : smoothstep(5200, 5900, local),
      hash: 0.15,
      scan: smoothstep(400, 4800, local),
      crossfade: 0,
      captionPulse: smoothstep(0, 400, local),
    };
  }

  if (t < 8800) {
    const cross = smoothstep(7800, 8600, t);
    return {
      fill: 1,
      typeProgress: 1,
      stamp: 1 - cross,
      hash: cross,
      scan: 0,
      crossfade: cross,
      captionPulse: 1 - Math.abs(cross - 0.5) * 2,
    };
  }

  const local = t - 8800;
  return {
    fill: smoothstep(300, 4500, local),
    typeProgress: clamp01(((local - 300) % 800) / 800),
    stamp: smoothstep(5600, 6400, local),
    hash: smoothstep(4200, 5200, local),
    scan: smoothstep(200, 5000, local),
    crossfade: 1,
    captionPulse: smoothstep(0, 350, local),
  };
}

function fieldVisibility(fill: number, index: number, total: number): number {
  const start = index / total;
  const end = (index + 0.85) / total;
  return smoothstep(start, end, fill);
}

function typedValue(raw: string, visibility: number, typeProgress: number, fill: number, index: number): string {
  if (visibility <= 0.02) return "";
  const wave = fieldVisibility(fill, index, FIELDS.length);
  const chars = Math.floor(raw.length * easeOutCubic(clamp01(wave * 1.15 + typeProgress * 0.08)));
  return raw.slice(0, Math.max(0, Math.min(raw.length, chars)));
}

function BrandMarkLocal({ tone }: { tone: "neutral" | "err" | "ok" }) {
  const mapped = tone === "ok" ? "pass" : tone === "err" ? "blocked" : "default";
  return <BrandMark className={styles.brandMark} tone={mapped} />;
}

type CardHandle = {
  root: HTMLDivElement | null;
  status: HTMLSpanElement | null;
  scan: HTMLDivElement | null;
  hash: HTMLSpanElement | null;
  meter: HTMLSpanElement | null;
  stamp: HTMLDivElement | null;
  values: Array<HTMLSpanElement | null>;
  rows: Array<HTMLDivElement | null>;
};

function paintCard(handle: CardHandle, scene: Scene, beat: Beat, active: boolean, opacity: number) {
  const root = handle.root;
  if (!root) return;

  root.style.opacity = String(opacity);
  root.style.pointerEvents = opacity < 0.2 ? "none" : "auto";

  const isStrong = scene === "strong";
  const stampStrength = active ? beat.stamp : opacity > 0.85 && isStrong ? 1 : 0;
  const fill = active ? beat.fill : isStrong && opacity > 0.5 ? 1 : opacity < 0.5 ? 0 : beat.fill;

  if (handle.scan) {
    handle.scan.style.setProperty("--scan", String(active ? beat.scan : 0));
  }

  const stamped = stampStrength > 0.55;
  root.classList.toggle(styles.dossierStamped, stamped);

  if (handle.status) {
    const status =
      stamped
        ? isStrong
          ? "Sealed · v5"
          : "Blocked"
        : isStrong
          ? fill > 0.5
            ? "Integrity check"
            : "Guided preparation"
          : fill > 0.5
            ? "Review failed"
            : "Draft · unmanaged";
    handle.status.textContent = status;
    handle.status.dataset.tone = stamped ? (isStrong ? "ok" : "err") : "neutral";
  }

  FIELDS.forEach((field, index) => {
    const raw = isStrong ? field.strong : field.weak;
    const vis = fieldVisibility(fill, index, FIELDS.length);
    const value = typedValue(raw, vis, active ? beat.typeProgress : 1, fill, index);
    const row = handle.rows[index];
    const valueEl = handle.values[index];
    if (row) {
      row.style.opacity = String(0.22 + vis * 0.78);
      row.style.transform = `translate3d(0, ${(1 - vis) * 12}px, 0)`;
      const incomplete = !isStrong && vis > 0.4;
      const complete = isStrong && vis > 0.55;
      row.dataset.tone = complete ? "ok" : incomplete ? (index > 1 ? "err" : "warn") : "muted";
    }
    if (valueEl) {
      if (value.length < raw.length && vis > 0.05) {
        valueEl.innerHTML = `${escapeHtml(value)}<i class="${styles.caret}"></i>`;
      } else if (!value) {
        valueEl.innerHTML = `<span class="${styles.placeholder}">awaiting input</span>`;
      } else {
        valueEl.textContent = value;
      }
    }
  });

  if (handle.hash) {
    handle.hash.style.opacity = String(0.35 + (active ? beat.hash : isStrong ? 1 : 0.2) * 0.65);
  }
  if (handle.meter) {
    handle.meter.style.width = `${Math.round(fill * 100)}%`;
  }
  if (handle.stamp) {
    handle.stamp.style.opacity = String(stampStrength);
    handle.stamp.style.transform = `scale(${0.55 + easeOutBack(stampStrength) * 0.45}) rotate(${-22 + stampStrength * 10}deg)`;
    handle.stamp.style.filter = `blur(${(1 - stampStrength) * 3.5}px)`;
  }
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function DossierCardShell({
  scene,
  handleRef,
}: {
  scene: Scene;
  handleRef: (handle: CardHandle) => void;
}) {
  const isStrong = scene === "strong";
  const rootRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const scanRef = useRef<HTMLDivElement>(null);
  const hashRef = useRef<HTMLSpanElement>(null);
  const meterRef = useRef<HTMLSpanElement>(null);
  const stampRef = useRef<HTMLDivElement>(null);
  const valueRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    handleRef({
      root: rootRef.current,
      status: statusRef.current,
      scan: scanRef.current,
      hash: hashRef.current,
      meter: meterRef.current,
      stamp: stampRef.current,
      values: valueRefs.current,
      rows: rowRefs.current,
    });
  }, [handleRef]);

  return (
    <div
      ref={rootRef}
      className={[styles.dossier, isStrong ? styles.dossierStrong : styles.dossierWeak].join(" ")}
      style={{ opacity: isStrong ? 0 : 1 }}
    >
      <div className={styles.paperGrain} aria-hidden="true" />
      <div className={styles.frame} aria-hidden="true" />
      <div ref={scanRef} className={styles.scanline} aria-hidden="true" />

      <header className={styles.head}>
        <BrandMarkLocal tone="neutral" />
        <div className={styles.headCopy}>
          <b>Evidence Dossier</b>
          <span ref={statusRef} className={styles.status} data-tone="neutral">
            Draft · unmanaged
          </span>
        </div>
      </header>

      <h3 className={styles.title}>
        CBAM Definitive-Period
        <br />
        <em>{isStrong ? "Verification Preparation Pack" : "Audit-Preparation Draft"}</em>
      </h3>

      <div className={styles.rows}>
        {FIELDS.map((field, index) => (
          <div
            key={field.label}
            ref={(el) => {
              rowRefs.current[index] = el;
            }}
            className={styles.row}
            data-tone="muted"
          >
            <b>{field.label}</b>
            <span
              ref={(el) => {
                valueRefs.current[index] = el;
              }}
              className={styles.value}
            >
              <span className={styles.placeholder}>awaiting input</span>
            </span>
          </div>
        ))}
      </div>

      <footer className={styles.foot}>
        <span ref={hashRef} className={styles.hash}>
          {isStrong ? "SHA-256 · 9f2a…c41d · immutable" : "SHA-256 · — missing integrity chain"}
        </span>
        <div className={styles.miniMeter} aria-hidden="true">
          <span ref={meterRef} />
        </div>
      </footer>

      <div
        ref={stampRef}
        className={[styles.stamp, isStrong ? styles.stampOk : styles.stampErr].join(" ")}
        style={{ opacity: 0 }}
      >
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
 * Premium hero narrative: one rAF clock paints the DOM directly (60fps, no React render thrash).
 * Continuous float + scan + dual-card morph. Nested timeouts intentionally avoided.
 */
export function HeroDossierNarrative() {
  const [captionScene, setCaptionScene] = useState<Scene>("weak");
  const [reducedMotion, setReducedMotion] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const stage3dRef = useRef<HTMLDivElement>(null);
  const ambientRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const timelineFillRef = useRef<HTMLSpanElement>(null);
  const weakHandle = useRef<CardHandle | null>(null);
  const strongHandle = useRef<CardHandle | null>(null);
  const tiltRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const lastCaption = useRef<Scene>("weak");

  const setWeakHandle = useCallback((h: CardHandle) => {
    weakHandle.current = h;
  }, []);
  const setStrongHandle = useCallback((h: CardHandle) => {
    strongHandle.current = h;
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduced = media.matches;
    // Defer React state write out of the synchronous effect body.
    const motionId = window.setTimeout(() => setReducedMotion(reduced), 0);

    const paintStaticStrong = () => {
      const beat = sampleBeat(0.72);
      paintCard(weakHandle.current || { root: null, status: null, scan: null, hash: null, meter: null, stamp: null, values: [], rows: [] }, "weak", beat, false, 0);
      paintCard(strongHandle.current || { root: null, status: null, scan: null, hash: null, meter: null, stamp: null, values: [], rows: [] }, "strong", beat, true, 1);
      if (timelineFillRef.current) timelineFillRef.current.style.width = "72%";
      if (ambientRef.current) ambientRef.current.dataset.scene = "strong";
      setCaptionScene("strong");
    };

    if (reduced) {
      const id = window.setTimeout(paintStaticStrong, 0);
      return () => {
        window.clearTimeout(motionId);
        window.clearTimeout(id);
      };
    }

    startRef.current = performance.now();
    const tick = (now: number) => {
      const cycle01 = ((now - startRef.current) % CYCLE_MS) / CYCLE_MS;
      const beat = sampleBeat(cycle01);
      const scene: Scene = beat.crossfade > 0.5 ? "strong" : "weak";

      if (weakHandle.current) {
        paintCard(weakHandle.current, "weak", beat, scene === "weak", 1 - beat.crossfade);
      }
      if (strongHandle.current) {
        paintCard(strongHandle.current, "strong", beat, scene === "strong", beat.crossfade);
      }

      if (timelineFillRef.current) {
        timelineFillRef.current.style.width = `${cycle01 * 100}%`;
      }
      if (ambientRef.current) {
        ambientRef.current.dataset.scene = scene;
      }
      if (captionRef.current) {
        captionRef.current.style.opacity = String(0.55 + beat.captionPulse * 0.45);
      }

      const floatY = Math.sin(cycle01 * Math.PI * 2) * 5;
      const floatRot = Math.sin(cycle01 * Math.PI * 2 + 1.2) * 0.35;
      const { x, y } = tiltRef.current;
      if (stage3dRef.current) {
        stage3dRef.current.style.transform = `translate3d(0, ${floatY}px, 0) rotateX(${6 + x}deg) rotateY(${-8 + y}deg) rotateZ(${floatRot}deg)`;
      }

      if (scene !== lastCaption.current) {
        lastCaption.current = scene;
        setCaptionScene(scene);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    // Start after first paint so card refs are populated.
    const bootId = window.setTimeout(() => {
      rafRef.current = requestAnimationFrame(tick);
    }, 0);

    return () => {
      window.clearTimeout(motionId);
      window.clearTimeout(bootId);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

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
      className={[styles.stage, reducedMotion ? styles.reduced : ""].join(" ")}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      role="img"
      aria-label="Animated comparison: an unmanaged CBAM dossier fails quality control, then a CBAMValid-prepared dossier is sealed and ready for independent verification."
    >
      <div ref={ambientRef} className={styles.ambient} data-scene="weak" aria-hidden="true" />
      <div className={styles.orbit} aria-hidden="true" />

      <div ref={captionRef} className={styles.caption}>
        <span className={styles.captionEyebrow} data-scene={captionScene}>
          {caption.eyebrow}
        </span>
        <p className={styles.captionTitle}>{caption.title}</p>
        <p className={styles.captionDetail}>{caption.detail}</p>
      </div>

      <div className={styles.timeline} aria-hidden="true">
        <span ref={timelineFillRef} className={styles.timelineFill} style={{ width: "0%" } as CSSProperties} />
        <div className={styles.timelineLabels}>
          <span className={captionScene === "weak" ? styles.tlActive : undefined}>Fail path</span>
          <span className={captionScene === "strong" ? styles.tlActive : undefined}>Seal path</span>
        </div>
      </div>

      <div ref={stage3dRef} className={styles.stage3d}>
        <div className={styles.cardStack}>
          <DossierCardShell scene="weak" handleRef={setWeakHandle} />
          <DossierCardShell scene="strong" handleRef={setStrongHandle} />
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
