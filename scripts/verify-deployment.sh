#!/usr/bin/env bash
# Verify a deployed evaluation app: HTTP 200, fixtures reachable, manifest present.
set -euo pipefail

BASE_URL="${1:?Usage: npm run verify:deployment -- https://your-site.netlify.app}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MATRIX="${ROOT_DIR}/compatibility/test-matrix.json"

echo "=== Deployment verification ==="
echo "Target: ${BASE_URL}"
echo

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

pass() {
  echo "PASS: $1"
}

CURL_OPTS=()
if [[ "${BASE_URL}" == https://* ]]; then
  CURL_OPTS+=(-k)
fi

curl_deploy() {
  curl "${CURL_OPTS[@]}" "$@"
}

# 1. App loads
HTTP_CODE=$(curl_deploy -sS -o /dev/null -w '%{http_code}' "${BASE_URL}/")
[[ "${HTTP_CODE}" == "200" ]] || fail "App root returned HTTP ${HTTP_CODE}"
pass "App loads (HTTP 200)"

# 2. COOP/COEP headers
curl_deploy -sSI "${BASE_URL}/" | grep -qi 'cross-origin-opener-policy: same-origin' || fail "Missing COOP header"
curl_deploy -sSI "${BASE_URL}/" | grep -qi 'cross-origin-embedder-policy: require-corp' || fail "Missing COEP header"
pass "COOP/COEP headers present"

# 2b. HTTPS warning for LAN deployments
if [[ "${BASE_URL}" == http://* ]] && [[ "${BASE_URL}" != http://localhost* ]] && [[ "${BASE_URL}" != http://127.0.0.1* ]]; then
  echo "WARN: ffprobe-wasm requires HTTPS (or localhost). Plain HTTP on a LAN IP disables SharedArrayBuffer."
  echo "      Generate certs: bash deploy/generate-tls-cert.sh && rsync deploy/tls/ to server"
fi

# 3. Manifest
MANIFEST_CODE=$(curl_deploy -sS -o /tmp/fixture-manifest.json -w '%{http_code}' "${BASE_URL}/fixtures/manifest.json")
[[ "${MANIFEST_CODE}" == "200" ]] || fail "Fixture manifest missing (HTTP ${MANIFEST_CODE}) — run fixtures:generate before build"
pass "Fixture manifest reachable"

# 4. Core fixtures from manifest
CORE_COUNT=$(node -e "const m=require('/tmp/fixture-manifest.json'); console.log((m.core||[]).length)")
OPTIONAL_COUNT=$(node -e "const m=require('/tmp/fixture-manifest.json'); console.log((m.optional||[]).length)")
echo "Manifest: ${CORE_COUNT} core, ${OPTIONAL_COUNT} optional fixtures"

MISSING=0
while IFS= read -r fixture; do
  [[ -z "${fixture}" ]] && continue
  CODE=$(curl_deploy -sS -o /dev/null -w '%{http_code}' "${BASE_URL}/fixtures/${fixture}")
  if [[ "${CODE}" != "200" ]]; then
    echo "MISSING: /fixtures/${fixture} (HTTP ${CODE})"
    MISSING=$((MISSING + 1))
  fi
done < <(node -e "const m=require('/tmp/fixture-manifest.json'); (m.core||[]).forEach(f=>console.log(f))")

[[ "${MISSING}" -eq 0 ]] || fail "${MISSING} core fixture(s) missing from deployed build"
pass "All ${CORE_COUNT} core fixture URLs return HTTP 200"

# 5. Test matrix JSON
MATRIX_CODE=$(curl_deploy -sS -o /dev/null -w '%{http_code}' "${BASE_URL}/compatibility/test-matrix.json")
[[ "${MATRIX_CODE}" == "200" ]] || fail "Test matrix JSON missing (HTTP ${MATRIX_CODE})"
pass "Test matrix JSON reachable"

# 6. Main JS bundle
INDEX_HTML=$(curl_deploy -sS "${BASE_URL}/")
MAIN_JS=$(echo "${INDEX_HTML}" | grep -oE '/assets/index-[^"]+\.js' | head -1)
[[ -n "${MAIN_JS}" ]] || fail "Could not find main JS bundle in index.html"
JS_CODE=$(curl_deploy -sS -o /dev/null -w '%{http_code}' "${BASE_URL}${MAIN_JS}")
[[ "${JS_CODE}" == "200" ]] || fail "Main JS bundle missing (HTTP ${JS_CODE})"
pass "Main JS bundle reachable"

# 7. ffprobe-wasm lazy chunk
FFPROBE_JS=$(echo "${INDEX_HTML}" | grep -oE '/assets/ffprobe-wasm-[^"]+\.js' | head -1 || true)
if [[ -n "${FFPROBE_JS}" ]]; then
  FF_CODE=$(curl_deploy -sS -o /dev/null -w '%{http_code}' "${BASE_URL}${FFPROBE_JS}")
  [[ "${FF_CODE}" == "200" ]] || fail "ffprobe-wasm chunk missing (HTTP ${FF_CODE})"
  pass "ffprobe-wasm lazy chunk reachable"
else
  echo "WARN: ffprobe-wasm chunk not referenced in index.html (may load dynamically)"
fi

echo
echo "=== All deployment checks passed ==="
echo "Manual: open ${BASE_URL} → Test matrix → Run all tests → Export CSV / Markdown"
