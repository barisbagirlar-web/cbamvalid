#!/usr/bin/env bash
# Lab CWV regression gate — 3 cold-run median per template.
# Field CWV remains NOT_PROVEN_PRE_DEPLOY.
# Regression vs docs/seo/lab-cwv-baseline.json (+15%). Absolute LCP≤2.5s reported separately.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
PORT="${SEO_CWV_PORT:-3012}"
BASE="http://127.0.0.1:${PORT}"
OUT_DIR="${ROOT}/.seo-cwv"
BASELINE_FILE="${ROOT}/docs/seo/lab-cwv-baseline.json"
METRICS_JSON="${OUT_DIR}/current-metrics.json"
mkdir -p "$OUT_DIR"
LOG="$(mktemp -t seo-cwv-server.XXXXXX)"
: > "$OUT_DIR/metrics.tsv"

TEMPLATES="/ /product /pricing /methodology /cbam-2026-definitive-period /cn-code/72011011"
MAX_CLS="0.10"
MAX_TBT_MS="800"
MAX_TTFB_MS="1500"
ABS_LCP_MS="2500"
REGRESSION_TOLERANCE="1.15"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$LOG"
}
trap cleanup EXIT

echo "LAB_CWV: ensuring production build..."
npm run build >/dev/null

echo "LAB_CWV: starting next on ${PORT}..."
npx next start --port "$PORT" >"$LOG" 2>&1 &
SERVER_PID=$!
for i in $(seq 1 60); do
  if curl -sf "$BASE/" >/dev/null 2>&1; then break; fi
  sleep 1
done
if ! curl -sf "$BASE/" >/dev/null 2>&1; then
  echo "LAB_PERFORMANCE_REGRESSION=FAIL server not ready"
  cat "$LOG" >&2
  exit 2
fi

median3() {
  python3 -c 'import sys; v=sorted(float(x) for x in sys.argv[1:]); print(v[1])' "$1" "$2" "$3"
}

fail=0
abs_fail=0

for path in $TEMPLATES; do
  slug=$(echo "$path" | sed 's#[^a-zA-Z0-9]#_#g')
  lcp_runs=""; cls_runs=""; tbt_runs=""; ttfb_runs=""
  set --
  lcp1=0; lcp2=0; lcp3=0
  cls1=0; cls2=0; cls3=0
  tbt1=0; tbt2=0; tbt3=0
  ttfb1=0; ttfb2=0; ttfb3=0
  run=1
  while [[ "$run" -le 3 ]]; do
    out="$OUT_DIR/${slug}_run${run}.json"
    npx --yes lighthouse "${BASE}${path}" \
      --quiet \
      --chrome-flags="--headless --no-sandbox --disable-dev-shm-usage" \
      --only-categories=performance \
      --form-factor=mobile \
      --output=json \
      --output-path="$out" >/dev/null 2>&1 || {
        echo "LAB_PERFORMANCE_REGRESSION=FAIL lighthouse failed for ${path} run ${run}"
        exit 1
      }
    metrics=$(python3 - "$out" <<'PY'
import json,sys
d=json.load(open(sys.argv[1]))
aud=d.get("audits",{})
def num(key):
  a=aud.get(key) or {}
  v=a.get("numericValue")
  return float(v) if isinstance(v,(int,float)) else 0.0
print(f"{num('largest-contentful-paint')} {num('cumulative-layout-shift')} {num('total-blocking-time')} {num('server-response-time')}")
PY
)
    eval "lcp${run}=\$(echo \$metrics | awk '{print \$1}')"
    eval "cls${run}=\$(echo \$metrics | awk '{print \$2}')"
    eval "tbt${run}=\$(echo \$metrics | awk '{print \$3}')"
    eval "ttfb${run}=\$(echo \$metrics | awk '{print \$4}')"
    run=$((run + 1))
  done

  med_lcp=$(median3 "$lcp1" "$lcp2" "$lcp3")
  med_cls=$(median3 "$cls1" "$cls2" "$cls3")
  med_tbt=$(median3 "$tbt1" "$tbt2" "$tbt3")
  med_ttfb=$(median3 "$ttfb1" "$ttfb2" "$ttfb3")

  echo "LAB_CWV path=${path} LCP_ms=${med_lcp} CLS=${med_cls} TBT_ms=${med_tbt} TTFB_ms=${med_ttfb}"
  printf '%s\t%s\t%s\t%s\t%s\n' "$path" "$med_lcp" "$med_cls" "$med_tbt" "$med_ttfb" >> "$OUT_DIR/metrics.tsv"

  python3 -c "import sys; sys.exit(0 if float('$med_cls')<=float('$MAX_CLS') else 1)" || { echo "FAIL ${path} CLS"; fail=1; }
  python3 -c "import sys; sys.exit(0 if float('$med_tbt')<=float('$MAX_TBT_MS') else 1)" || { echo "FAIL ${path} TBT"; fail=1; }
  python3 -c "import sys; sys.exit(0 if float('$med_ttfb')<=float('$MAX_TTFB_MS') else 1)" || { echo "FAIL ${path} TTFB"; fail=1; }
  python3 -c "import sys; sys.exit(0 if float('$med_lcp')<=float('$ABS_LCP_MS') else 1)" || { echo "ABS_LCP_NOT_MET ${path}"; abs_fail=1; }
done

python3 - "$OUT_DIR/metrics.tsv" "$METRICS_JSON" "$BASELINE_FILE" "$REGRESSION_TOLERANCE" <<'PY'
import json, sys
tsv, out_json, baseline_path, tol_s = sys.argv[1:5]
tol = float(tol_s)
cur = {}
for line in open(tsv):
  path, lcp, cls, tbt, ttfb = line.rstrip("\n").split("\t")
  cur[path] = {"lcp": float(lcp), "cls": float(cls), "tbt": float(tbt), "ttfb": float(ttfb)}
json.dump(cur, open(out_json, "w"), indent=2)
base = json.load(open(baseline_path))
failed = False
for path, m in cur.items():
  b = base.get(path)
  if not b:
    print(f"FAIL missing baseline for {path}")
    failed = True
    continue
  if m["lcp"] > b["lcp"] * tol:
    print(f"FAIL {path} LCP regression {m['lcp']} > {b['lcp']}*{tol}")
    failed = True
  if m["tbt"] > max(b["tbt"] * tol, 50):
    print(f"FAIL {path} TBT regression {m['tbt']} > {b['tbt']}*{tol}")
    failed = True
  if m["cls"] > 0.10:
    print(f"FAIL {path} CLS hard budget {m['cls']}")
    failed = True
if failed:
  print("LAB_CWV_REGRESSION=FAIL")
  sys.exit(1)
print("LAB_CWV_REGRESSION=PASS")
sys.exit(0)
PY
reg_rc=$?
if [[ "$reg_rc" -ne 0 ]]; then fail=1; fi

echo "FIELD_LCP=NOT_PROVEN_PRE_DEPLOY"
echo "FIELD_INP=NOT_PROVEN_PRE_DEPLOY"
echo "FIELD_CLS=NOT_PROVEN_PRE_DEPLOY"
if [[ "$abs_fail" -eq 0 ]]; then
  echo "LAB_ABSOLUTE_LCP_BUDGET=PASS"
else
  echo "LAB_ABSOLUTE_LCP_BUDGET=FAIL (mobile-throttled aspiration; regression is the deploy gate)"
fi

if [[ "$fail" -eq 0 ]]; then
  echo "LAB_PERFORMANCE_REGRESSION=PASS"
  exit 0
fi
echo "LAB_PERFORMANCE_REGRESSION=FAIL"
exit 1
