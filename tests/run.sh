#!/usr/bin/env bash
# Run a lab test in headless Edge and print the RESULT line.
#   tests/run.sh <name> "js/labs/x/a.js,js/labs/x/b.js" tests/x.test.js
# <name> keeps each run's browser profile separate, so several runs can go at once.
# Edge is launched through PowerShell (launching it straight from Git Bash can return nothing).
dir="$(cd "$(dirname "$0")" && pwd)"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(cygpath -w "$dir/run.ps1")" -name "$1" -labs "$2" -test "$3" -budget "${BUDGET:-20000}" | tr -d '\r'
