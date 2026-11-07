#!/usr/bin/env sh
# Railway entrypoint: start Python AI Engine internally, then serve Go Core API
# on the port Railway injects via $PORT.
set -eu

cd /home/user/app/ai-engine
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 &
AI_PID=$!

cleanup() {
  kill "$AI_PID" 2>/dev/null || true
}
trap cleanup INT TERM

# Wait up to 30 s for the AI Engine to answer. The public Core API can still
# start if this times out — generation endpoints will return an error until it
# recovers, but health/auth routes stay up.
i=0
while [ "$i" -lt 30 ]; do
  if python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=1)" >/dev/null 2>&1; then
    echo "AI Engine ready."
    break
  fi
  i=$((i + 1))
  sleep 1
done

if [ "$i" -eq 30 ]; then
  echo "WARNING: AI Engine did not become healthy in 30 s — continuing anyway."
fi

cd /home/user/app
exec ./core-api
