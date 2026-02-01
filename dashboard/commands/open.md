---
description: Start the dashboard server on localhost
argument-hint: "[port]"
disable-model-invocation: true
---

# Dashboard Open

!`bash "$CLAUDE_PLUGIN_ROOT/scripts/open.sh" $ARGUMENTS 2>&1`

Report the result above. If STATUS is:
- **STARTED**: Confirm the server is running and show the URL.
- **ALREADY_RUNNING**: Tell the user it's already running and show the URL.
- **BUILD_FAILED**: Report the build error.
- **FAILED**: Report the failure and show the log output.
