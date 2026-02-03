---
description: Start the dashboard server on localhost
argument-hint: "[path]"
disable-model-invocation: true
allowed-tools: Bash(flow open --no-browser:*)
---

# Dashboard Open

!`flow open --no-browser $ARGUMENTS 2>&1`

Report the result above. If STATUS is:
- **STARTED**: Confirm the server is running and show the URL.
- **ALREADY_RUNNING**: Tell the user it's already running and show the URL.
- **FAILED**: Report the failure and show the error.
