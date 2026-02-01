---
description: Check dashboard server status
disable-model-invocation: true
---

# Dashboard Status

!`bash "$CLAUDE_PLUGIN_ROOT/scripts/status.sh" 2>&1`

Report the status above. If STATUS is:
- **RUNNING**: Show the URL, PID, and whether Tailscale exposure is active.
- **NOT_RUNNING**: Tell the user and suggest running `/dashboard/open`.
