---
description: Remove Tailscale Serve exposure (keep server running locally)
disable-model-invocation: true
---

# Dashboard Unexpose

!`flow unexpose 2>&1`

Report the result above. If STATUS is:
- **UNEXPOSED**: Confirm remote access was removed. Mention the server is still running locally.
- **FAILED**: Report the error.
