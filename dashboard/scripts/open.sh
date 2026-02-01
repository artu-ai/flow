#!/bin/bash
# Start the dashboard server on localhost.
# Usage: open.sh [port]

DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${1:-3420}"
PID_FILE="$DIR/.dashboard.pid"
LOG_FILE="$DIR/.dashboard.log"

# Check if already running
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "STATUS: ALREADY_RUNNING"
        echo "URL: http://localhost:$PORT"
        echo "PID: $PID"
        exit 0
    else
        # Stale PID file
        rm -f "$PID_FILE"
    fi
fi

# Build if needed
if [ ! -d "$DIR/build" ]; then
    echo "BUILDING..."
    (cd "$DIR" && npm run build) 2>&1
    if [ $? -ne 0 ]; then
        echo "STATUS: BUILD_FAILED"
        exit 1
    fi
fi

# Start server
cd "$DIR"
PORT="$PORT" nohup node server.js > "$LOG_FILE" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > "$PID_FILE"

# Wait for server to be ready
sleep 2

if kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "STATUS: STARTED"
    echo "URL: http://localhost:$PORT"
    echo "PID: $SERVER_PID"
else
    echo "STATUS: FAILED"
    echo "LOGS:"
    tail -20 "$LOG_FILE" 2>/dev/null
    rm -f "$PID_FILE"
fi
