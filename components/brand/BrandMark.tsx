type BrandMarkProps = {
  className?: string;
  tone?: "default" | "on-dark" | "pass" | "blocked";
};

const TONE_CLASS: Record<NonNullable<BrandMarkProps["tone"]>, string> = {
  default: "brand-mark-tone-default",
  "on-dark": "brand-mark-tone-on-dark",
  pass: "brand-mark-tone-pass",
  blocked: "brand-mark-tone-blocked",
};

/** Shared CBAMValid shield mark — colors via CSS variables only. */
export function BrandMark({ className = "brand-mark", tone = "default" }: BrandMarkProps) {
  return (
    <svg
      className={`${className} ${TONE_CLASS[tone]}`.trim()}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <path
        className="brand-mark-shield"
        d="M20 3 35 9.5v9.7c0 8.9-6.2 15-15 17.8C11.2 34.2 5 28.1 5 19.2V9.5L20 3Z"
        strokeWidth="2.6"
      />
      <path
        className="brand-mark-check"
        d="m13.5 20.2 4.3 4.3 8.7-9"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
