---
description: Install Flow and its dependencies (Node.js check, npm install, Tailscale)
disable-model-invocation: true
allowed-tools: Bash(bash -c 'curl -fsSL https://raw.githubusercontent.com/artu-ai/flow/main/install.sh | bash':*)
---

# Dashboard Setup

!`bash -c 'curl -fsSL https://raw.githubusercontent.com/artu-ai/flow/main/install.sh | bash' 2>&1`

Report the result above. If the setup:
- **Completed successfully**: Confirm everything is installed and suggest the user run `/dashboard:open` to get started.
- **Failed on Node.js**: Tell the user to install Node.js v18+ first and provide the install link.
- **Failed on npm install**: Show the error and suggest running `npm install -g @artu-ai/flow` manually.
- **Skipped Tailscale**: Mention it's optional and only needed for remote access via `/dashboard:expose`.
