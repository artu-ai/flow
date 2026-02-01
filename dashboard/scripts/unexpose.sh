#!/bin/bash
# Remove Tailscale Serve exposure.

OUTPUT=$(tailscale serve off 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "STATUS: UNEXPOSED"
else
    echo "STATUS: FAILED"
    echo "ERROR: $OUTPUT"
fi
