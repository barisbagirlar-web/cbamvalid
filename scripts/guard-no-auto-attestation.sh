#!/usr/bin/env bash
# G-14 — professional boundary protection. CI runs this on every release.
# Guards against any automatic rule elevating evidence to an approved state or
# implying a verification opinion. A match exits 1.
set -u

REPO_ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
if [ ! -d "$REPO_ROOT/functions/src" ]; then
  echo "G-14 FAIL: not a repository root: $REPO_ROOT" >&2
  exit 1
fi

MATCHES=0

# Automatic elevation: assigning APPROVED/SUPPORTED/CLEAN to an evidence
# review or support state from a rule, without a human actor. Comparisons
# (===) are reads and are allowed; assignment or object-literal construction
# from an automated rule is banned. malwareScanStatus is a security-scan
# result, not an attestation, and is intentionally out of scope.
LITERALS='(APPROVED|SUPPORTED|CLEAN)'
OBJECT_LITERAL_PATTERN="(reviewStatus|supportStatus)[[:space:]]*:[[:space:]]*[\`\"']${LITERALS}[\`\"']"
ASSIGNMENT_PATTERN="(reviewStatus|supportStatus)[[:space:]]*=(?!=)[[:space:]]*[\`\"']${LITERALS}[\`\"']"
while IFS= read -r -d '' file; do
  hits=$(grep -anPE "$OBJECT_LITERAL_PATTERN|$ASSIGNMENT_PATTERN" "$file" 2>/dev/null || true)
  if [ -n "$hits" ]; then
    echo "G-14 AUTO-ATTESTATION in $file:"
    echo "$hits"
    MATCHES=$((MATCHES + 1))
  fi
done < <(find "$REPO_ROOT/functions/src" -name '*.ts' -print0)

# Opinion implication: outputs asserting a verification opinion or submission
# readiness. Negated statements ("no independent verification opinion is") are
# the mandated boundary disclosure and are not implications.
while IFS= read -r -d '' file; do
  hits=$(grep -aniE "(verification opinion is|approved by verifier|audit opinion|assurance provided|ready for submission)" "$file" 2>/dev/null | grep -aviE "(not|no|never|forbidden)" || true)
  if [ -n "$hits" ]; then
    echo "G-14 OPINION-IMPLICATION in $file:"
    echo "$hits"
    MATCHES=$((MATCHES + 1))
  fi
done < <(find "$REPO_ROOT/functions/src" -name '*.ts' -print0)

if [ "$MATCHES" -gt 0 ]; then
  echo "G-14 FAIL: $MATCHES automated attestation pattern(s) found." >&2
  exit 1
fi

echo "G-14 PASS: no automatic evidence elevation or opinion implication"
exit 0
