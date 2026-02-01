---
description: Expose dashboard via Tailscale Serve for remote access
disable-model-invocation: true
---

# Dashboard Expose

!`bash "$CLAUDE_PLUGIN_ROOT/scripts/expose.sh" 2>&1`

Report the result above. If STATUS is:
- **EXPOSED**: Confirm remote access is active and show the Tailscale URL from the serve status.
- **SERVER_NOT_RUNNING**: Tell the user to start the server first with `/dashboard/open`.
- **FAILED**: Report the error (likely Tailscale not installed or not connected).
