#!/usr/bin/env bash
# Rewrite the chapter <script> block in index.html for every chapter in tests/chapters.txt
# whose files are all committed. Usage: bash tests/wire.sh [version]
cd "$(dirname "$0")/.." || exit 1
v="${1:-1}"; block=""
while read -r line; do
  case "$line" in ''|\#*) continue;; esac
  ch="${line%%:*}"; labs="${line#*:}"; ok=1
  # only chapters whose files are all committed (in-progress work is left out)
  git ls-files --error-unmatch "js/labs/$ch/map.js" >/dev/null 2>&1 || ok=0
  for l in $labs; do git ls-files --error-unmatch "js/labs/$ch/$l.js" >/dev/null 2>&1 || ok=0; done
  [ $ok = 1 ] || continue
  block="$block  <script src=\"js/labs/$ch/map.js?v=$v\"></script>\n"
  for l in $labs; do block="$block  <script src=\"js/labs/$ch/$l.js?v=$v\"></script>\n"; done
done < tests/chapters.txt
perl -0pi -e 's|\n  <!-- chapters -->.*?<!-- /chapters -->||s' index.html
perl -0pi -e "s|(  <script src=\"js/labs/pulleys.js\?v=\d+\"></script>)|\$1\n  <!-- chapters -->\n${block}  <!-- /chapters -->|" index.html
grep -c 'js/labs/.*/map.js' index.html
