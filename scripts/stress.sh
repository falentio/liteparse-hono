#!/usr/bin/env bash
# stress.sh — concurrent stress test for liteparse-hono /parse-stream
#
# Spawns <concurrency> parallel workers; each worker fires 3 sequential
# PDF POST /parse-stream requests. Total requests = concurrency × 3.
#
# Usage:
#   scripts/stress.sh <concurrency> <baseurl> [apikey]
#
# Example:
#   scripts/stress.sh 4 https://liteparse-hono.fly.dev
#   LITEPARSE_API_KEY=... scripts/stress.sh 8 https://staging.example.com
#
# Env:
#   LITEPARSE_API_KEY  Bearer token (overridden by 3rd arg)
#   PDF_PATH          Override the PDF fixture (default: data/pe_deal_examples.pdf
#                      relative to repo root)
#
# Requires: curl, awk, sort, date (GNU), sed, mktemp

set -euo pipefail

readonly PER_WORKER=3
readonly CURL_TIMEOUT=60

usage() {
  cat <<'EOF'
Usage: stress.sh <concurrency> <baseurl> [apikey]

Arguments:
  concurrency  Number of parallel workers (positive integer)
  baseurl      Server base URL (http:// or https://)
  apikey       Authorization Bearer token (default: $LITEPARSE_API_KEY)
EOF
  exit "${1:-0}"
}

[[ "${1:-}" =~ ^(-h|--help|help)$ ]] && usage 0
[[ $# -lt 2 ]] && usage 1

CONCURRENCY="$1"
BASEURL="$2"
APIKEY="${3:-${LITEPARSE_API_KEY:-}}"

if ! [[ "$CONCURRENCY" =~ ^[1-9][0-9]*$ ]]; then
  echo "Error: concurrency must be a positive integer (got '$CONCURRENCY')" >&2
  exit 1
fi
if [[ -z "$APIKEY" ]]; then
  echo "Error: API key required (pass as 3rd arg or set LITEPARSE_API_KEY)" >&2
  exit 1
fi
case "$BASEURL" in
  http://*|https://*) ;;
  *) echo "Error: baseurl must start with http:// or https://" >&2; exit 1 ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PDF_PATH="${PDF_PATH:-$REPO_ROOT/data/pe_deal_examples.pdf}"

if [[ ! -f "$PDF_PATH" ]]; then
  echo "Error: PDF not found at $PDF_PATH" >&2
  exit 1
fi

readonly TOTAL_REQS=$((CONCURRENCY * PER_WORKER))
readonly WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

echo "=== Stress test ==="
echo "  Base URL:    $BASEURL"
echo "  Concurrency: $CONCURRENCY parallel workers"
echo "  Per worker:  $PER_WORKER sequential PDFs"
echo "  Total:       $TOTAL_REQS requests"
echo "  PDF:         $PDF_PATH"
echo ""

# Each request produces:
#   $WORKDIR/req.<worker>.<iter>.meta  ->  line 1: status, line 2: duration (s)
#   $WORKDIR/req.<worker>.<iter>.body  ->  response body
worker() {
  local id="$1"
  for i in $(seq 1 "$PER_WORKER"); do
    local meta="$WORKDIR/req.$id.$i.meta"
    local body="$WORKDIR/req.$id.$i.body"
    local start end status duration
    start="$(date +%s.%N)"
    status="$(curl -sS --max-time "$CURL_TIMEOUT" \
      -o "$body" \
      -w "%{http_code}" \
      -X POST \
      -H "Authorization: Bearer $APIKEY" \
      -F "file=@$PDF_PATH" \
      "$BASEURL/parse-stream" 2>/dev/null)" || status="000"
    [[ -z "$status" ]] && status="000"
    end="$(date +%s.%N)"
    duration="$(awk -v s="$start" -v e="$end" 'BEGIN{printf "%.3f", e-s}')"
    printf '%s\n%s\n' "$status" "$duration" > "$meta"
  done
}

WALL_START="$(date +%s.%N)"
for w in $(seq 1 "$CONCURRENCY"); do
  worker "$w" &
done
wait
WALL_END="$(date +%s.%N)"
WALL_DUR="$(awk -v s="$WALL_START" -v e="$WALL_END" 'BEGIN{printf "%.3f", e-s}')"

SUCCESS=0
FAIL=0
declare -a DURATIONS=()
for meta in "$WORKDIR"/req.*.meta; do
  status="$(sed -n '1p' "$meta")"
  duration="$(sed -n '2p' "$meta")"
  [[ "$status" == "200" ]] && SUCCESS=$((SUCCESS+1)) || FAIL=$((FAIL+1))
  DURATIONS+=("$duration")
done
COUNT=${#DURATIONS[@]}

printf "%s\n" "${DURATIONS[@]}" | sort -n > "$WORKDIR/sorted"
P50="$(awk -v c="$COUNT" 'NR==int(c*0.5+0.5)'  "$WORKDIR/sorted")"
P95="$(awk -v c="$COUNT" 'NR==int(c*0.95+0.5)' "$WORKDIR/sorted")"
P99="$(awk -v c="$COUNT" 'NR==int(c*0.99+0.5)' "$WORKDIR/sorted")"
MIN="$(head -n 1 "$WORKDIR/sorted")"
MAX="$(tail -n 1 "$WORKDIR/sorted")"
MEAN="$(awk '{s+=$1; n++} END{if(n>0)printf "%.3f", s/n; else print "0"}' "$WORKDIR/sorted")"
RPS="$(awk -v c="$COUNT" -v w="$WALL_DUR" 'BEGIN{if(w>0)printf "%.2f", c/w; else print "0"}')"
SUCCESS_PCT="$(awk -v s="$SUCCESS" -v c="$COUNT" 'BEGIN{if(c>0)printf "%.1f", s/c*100; else print "0.0"}')"

echo "=== Results ==="
printf "  Wall time:    %s s\n" "$WALL_DUR"
printf "  Total reqs:   %d\n" "$COUNT"
printf "  Success:      %d (%s%%)\n" "$SUCCESS" "$SUCCESS_PCT"
printf "  Failure:      %d\n" "$FAIL"
printf "  Throughput:   %s req/s\n" "$RPS"
echo ""
echo "  Latency (s):"
printf "    min:   %s\n" "$MIN"
printf "    mean:  %s\n" "$MEAN"
printf "    p50:   %s\n" "$P50"
printf "    p95:   %s\n" "$P95"
printf "    p99:   %s\n" "$P99"
printf "    max:   %s\n" "$MAX"

if [[ "$FAIL" -gt 0 ]]; then
  echo ""
  echo "  Non-200 responses (up to 5):"
  shown=0
  for meta in "$WORKDIR"/req.*.meta; do
    [[ "$shown" -ge 5 ]] && break
    status="$(sed -n '1p' "$meta")"
    [[ "$status" == "200" ]] && continue
    body="${meta%.meta}.body"
    body_text="$(head -c 200 "$body")"
    echo "    $(basename "$meta") [$status]: $body_text"
    shown=$((shown+1))
  done
  exit 1
fi
