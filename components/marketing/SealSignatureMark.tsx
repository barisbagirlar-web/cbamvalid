/**
 * Visual exclusivity mark for sealed packages (FAZ 5).
 * Recognizable seal + hash/ruleset pin — not a fake accreditation badge.
 */
export function SealSignatureMark(props: {
  rulesetVersion?: string | null;
  documentHash?: string | null;
  compact?: boolean;
}) {
  const hashShort = props.documentHash
    ? `${props.documentHash.slice(0, 10)}…${props.documentHash.slice(-8)}`
    : "SHA-256 pin on seal";
  const ruleset = props.rulesetVersion || "Named ruleset pin";

  return (
    <aside
      className="seal-signature"
      aria-label="CBAMValid sealed package signature mark"
      data-compact={props.compact ? "true" : "false"}
    >
      <div className="seal-signature-ring" aria-hidden="true">
        <span>SEALED</span>
      </div>
      <div className="seal-signature-body">
        <p className="seal-signature-brand">
          CBAM<em>Valid</em> integrity mark
        </p>
        <p className="mono seal-signature-line">{ruleset}</p>
        <p className="mono seal-signature-line">{hashShort}</p>
        <p className="seal-signature-note">
          Operator-prepared · Not an accredited verification opinion
        </p>
      </div>
    </aside>
  );
}
