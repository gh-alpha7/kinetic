#!/usr/bin/env bash
# Run a lab test in headless Edge and print the RESULT line.
#   tests/run.sh <name> "js/labs/x/a.js,js/labs/x/b.js" tests/x.test.js
# <name> keeps each run's browser profile separate, so several runs can go at once.
name="$1"; labs="$2"; test="$3"
edge="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
prof="$(cygpath -w "${TMPDIR:-/tmp}")\edge-test-$name"
"$edge" --headless=new --disable-gpu --no-first-run --user-data-dir="$prof" --window-size=1400,1000 \
  --virtual-time-budget="${BUDGET:-20000}" --dump-dom \
  "http://localhost:5400/tests/harness.html?labs=$labs&test=$test" 2>/dev/null \
  | grep -o 'RESULT .*' | sed 's/<\/pre>.*//' | sed 's/&quot;/"/g; s/&lt;/</g; s/&gt;/>/g; s/&amp;/\&/g'
