#!/bin/bash
# Expose dashboard via Tailscale Serve.

DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$DIR/.dashboard.pid"

# Verify server is running
if [ ! -f "$PID_FILE" ] || ! kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "STATUS: SERVER_NOT_RUNNING"
    exit 0
fi

# Expose via Tailscale
OUTPUT=$(tailscale serve --bg 3420 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "STATUS: EXPOSED"
    echo "TAILSCALE_OUTPUT: $OUTPUT"
    # Get serve status for the URL
    echo "SERVE_STATUS:"
    tailscale serve status 2>/dev/null
else
    echo "STATUS: FAILED"
    echo "ERROR: $OUTPUT"
fi
