#!/bin/bash
# Check dashboard server status.

DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$DIR/.dashboard.pid"

if [ ! -f "$PID_FILE" ]; then
    echo "STATUS: NOT_RUNNING"
    exit 0
fi

PID=$(cat "$PID_FILE")

if ! kill -0 "$PID" 2>/dev/null; then
    rm -f "$PID_FILE"
    echo "STATUS: NOT_RUNNING"
    echo "NOTE: Cleaned up stale PID file"
    exit 0
fi

echo "STATUS: RUNNING"
echo "PID: $PID"

# Try to determine port from process args
PORT=$(ps -p "$PID" -o args= 2>/dev/null | grep -o 'PORT=[0-9]*' | cut -d= -f2)
PORT="${PORT:-3420}"
echo "URL: http://localhost:$PORT"

# Check Tailscale exposure
TS_STATUS=$(tailscale serve status 2>/dev/null)
if [ -n "$TS_STATUS" ] && echo "$TS_STATUS" | grep -q "$PORT"; then
    echo "TAILSCALE: EXPOSED"
    echo "TAILSCALE_STATUS:"
    echo "$TS_STATUS"
else
    echo "TAILSCALE: NOT_EXPOSED"
fi
