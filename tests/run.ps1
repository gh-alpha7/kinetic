# Run a lab test in headless Edge and print the RESULT line (called by tests/run.sh).
param([string]$name, [string]$labs, [string]$test, [int]$budget = 20000)
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$url = "http://localhost:5400/tests/harness.html?labs=$labs&test=$test"
$out = & $edge --headless=new --disable-gpu --no-first-run "--user-data-dir=$env:TEMP\edge-test-$name" --window-size=1400,1000 "--virtual-time-budget=$budget" --dump-dom $url 2>$null | Out-String
$m = [regex]::Match($out, 'RESULT .*?(?=</pre>)', 'Singleline')
if ($m.Success) { [System.Net.WebUtility]::HtmlDecode($m.Value) } else { "NO RESULT (page did not finish: check for a syntax error or raise BUDGET)" }
