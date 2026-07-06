#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | node -e "
let d='';
process.stdin.on('data',c=>d+=c);
process.stdin.on('end',()=>{
  try {
    const j=JSON.parse(d);
    console.log(j.file_path||j.path||j.file||'');
  } catch { console.log(''); }
}")

if echo "$FILE_PATH" | grep -qE 'heal-session\.json|current-session\.md|proposed\.patch'; then
  cd "$ROOT"
  node scripts/heal/notify-agent.mjs 2>/dev/null || true
fi
exit 0
