/** Silent route transition — spinner only, no visible loading copy in HTML. */
export default function Loading() {
  return (
    <div
      className="min-h-[40vh] flex items-center justify-center"
      aria-busy="true"
      aria-label="Busy"
    >
      <div
        className="w-6 h-6 border-2 border-[color:var(--line)] border-t-[color:var(--terra)] rounded-full animate-spin"
        aria-hidden="true"
      />
    </div>
  );
}
