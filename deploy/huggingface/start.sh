#!/usr/bin/env sh
set -eu

cd /home/user/app/ai-engine
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 &
AI_PID=$!

cleanup() {
  kill "$AI_PID" 2>/dev/null || true
}
trap cleanup INT TERM

# Wait briefly for the internal AI Engine to answer. The public Core API can
# still start if this fails; generation endpoints will report an error.
i=0
while [ "$i" -lt 30 ]; do
  if python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=1)" >/dev/null 2>&1; then
    break
  fi
  i=$((i + 1))
  sleep 1
done

cd /home/user/app
exec ./core-api
