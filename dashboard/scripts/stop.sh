#!/bin/bash
# Stop the dashboard server.

DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$DIR/.dashboard.pid"

if [ ! -f "$PID_FILE" ]; then
    echo "STATUS: NOT_RUNNING"
    exit 0
fi

PID=$(cat "$PID_FILE")

# Remove Tailscale exposure if active
tailscale serve off 2>/dev/null

# Graceful shutdown
if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null
    # Wait up to 5 seconds for graceful shutdown
    for i in $(seq 1 10); do
        if ! kill -0 "$PID" 2>/dev/null; then
            break
        fi
        sleep 0.5
    done
    # Force kill if still alive
    if kill -0 "$PID" 2>/dev/null; then
        kill -9 "$PID" 2>/dev/null
    fi
fi

rm -f "$PID_FILE"
echo "STATUS: STOPPED"
