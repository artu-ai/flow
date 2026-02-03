---
description: Check dashboard server status
disable-model-invocation: true
allowed-tools: Bash(flow list:*)
---

# Dashboard Status

!`flow list 2>&1`

Report the status above. If STATUS is:
- Shows **PROJECT** entries: List the running dashboards with their URLs.
- **NO_PROJECTS**: Tell the user no dashboards are running and suggest `/dashboard:open`.
