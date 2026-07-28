"use client";

import React, { useRef, useEffect, useState, type ReactNode } from "react";

/** Scroll-reveal wrapper that keeps the `in` class in React state. */
export function Reveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      const id = window.setTimeout(() => setVisible(true), 0);
      return () => window.clearTimeout(id);
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal${visible ? " in" : ""}${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
}

/**
 * Count-up progressive enhancement.
 * SSR and first paint render `to` (never 0). Animation may only run from a
 * lower value UP to the SSR value after hydration + intersection.
 */
export function CountUp({
  to,
  suffix = "",
  className,
}: {
  to: number;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [value, setValue] = useState(to);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (to <= 0) return;

    const run = () => {
      if (started.current) return;
      started.current = true;
      const from = Math.max(0, Math.floor(to * 0.35));
      const dur = 1300;
      let start: number | null = null;
      setValue(from);
      const step = (ts: number) => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        setValue(Math.round(from + (to - from) * eased));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    if (!("IntersectionObserver" in window)) {
      const id = window.setTimeout(run, 0);
      return () => window.clearTimeout(id);
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            run();
            io.disconnect();
          }
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to]);

  return (
    <span ref={ref} className={className}>
      {value}
      {suffix}
    </span>
  );
}

export function FaqItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`faq-item${isOpen ? " open" : ""}`}>
      <button
        type="button"
        className="faq-q"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((v) => !v)}
      >
        {question}
        <span className="chev">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>
      <div className="faq-a" style={{ maxHeight: isOpen ? "420px" : "0px" }}>
        <p>{answer}</p>
      </div>
    </div>
  );
}

/**
 * Optional one-shot class reveal for pages that still use bare `.reveal`
 * markup. Only adds `in`; never mutates text or structure.
 * Prefer <Reveal> for new markup.
 */
export function useClassReveal() {
  useEffect(() => {
    const revealEls = document.querySelectorAll<HTMLElement>(".reveal:not(.in)");
    if (!revealEls.length) return;

    if (!("IntersectionObserver" in window)) {
      revealEls.forEach((el) => el.classList.add("in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12 },
    );
    revealEls.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
