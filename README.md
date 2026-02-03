# Flow

Development dashboard and workflow automation for Claude Code.

Flow is a daemon-based process manager that runs a per-project development dashboard (SvelteKit + Monaco + xterm.js) and integrates with Linear and GitHub via Claude Code plugins.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/artu-ai/flow/main/install.sh | bash
```

Or with npm directly:

```bash
npm install -g @artu-ai/flow
```

Or from within Claude Code:

```
/dashboard/setup
```

### Requirements

- Node.js 18+
- [Tailscale](https://tailscale.com/) (optional, for remote access via `flow expose`)

## How It Works

Flow runs a **daemon process** (`~/.flow/daemon.sock`) that manages one dashboard server per project. Each server runs on a separate port (starting at 3420) and is scoped to a project's git root via the `PROJECT_ROOT` environment variable.

```
flow open          →  daemon auto-starts  →  spawns server on :3420  →  opens browser
flow open /other   →  (daemon running)    →  spawns server on :3421  →  opens browser
flow list          →  shows both projects
flow stop          →  stops current project's server
flow shutdown      →  stops all servers + daemon
```

Global config (Linear API key, completion settings) is stored at `~/.flow/config.json` and shared across all projects.

## CLI

```
flow open [path]       Start/open a project dashboard (default: cwd)
flow list              List running dashboards
flow stop [path]       Stop a project dashboard (default: cwd)
flow stop-all          Stop all dashboards
flow shutdown          Stop daemon and all dashboards
flow expose [path]     Expose via Tailscale Serve
flow unexpose          Remove Tailscale exposure
flow --version         Show version
```

## Plugins

Flow ships with two Claude Code plugins. Load them via the marketplace or with `--plugin-dir`:

```bash
claude --plugin-dir ./plugins/flow
claude --plugin-dir ./plugins/dashboard
```

### Dashboard

| Command | Description |
|---------|-------------|
| `/dashboard/setup` | Install Flow and dependencies (Node.js check, npm, Tailscale) |
| `/dashboard/open [path]` | Start the dashboard server for a project |
| `/dashboard/stop` | Stop the dashboard server |
| `/dashboard/status` | List running dashboards |
| `/dashboard/expose` | Expose dashboard via Tailscale Serve for remote access |
| `/dashboard/unexpose` | Remove Tailscale exposure |

#### Features

- **File browser** — Sidebar with lazy-loading directory tree, gitignore-aware
- **Monaco editor** — Syntax highlighting, Cmd+S save, AI inline completions (Ollama / Claude)
- **Diff viewer** — Side-by-side diff for changed files
- **Terminal** — xterm.js with PTY, opens in selected worktree
- **Worktree tabs** — Switch between worktrees from the navbar
- **Lint & format** — Biome, ESLint, Ruff integration
- **Linear integration** — View assigned issues, create worktrees from issues
- **Remote access** — Expose via Tailscale for access from other devices

### Flow

Linear + GitHub workflow automation. Supports **parallel development** using git worktrees.

| Command | Description |
|---------|-------------|
| `/flow/checkout [issue-id]` | Create a worktree and branch for a Linear issue |
| `/flow/commit [issue-id]` | Commit, create draft PR, comment on Linear issue |
| `/flow/commit-leftovers` | Commit remaining unrelated changes |
| `/flow/create-issue` | Create a new Linear issue |
| `/flow/done` | Complete issue after PR merge, clean up worktree |
| `/flow/draft` | Convert PR back to draft |
| `/flow/ready` | Mark PR as ready for review |
| `/flow/cancel` | Cancel work, close PR, clean up worktree |
| `/flow/my-issues` | List assigned Linear issues |
| `/flow/next-issue` | Pick up next prioritized issue |
| `/flow/progress` | Show current issue and PR status |
| `/flow/continue` | Resume work on an in-progress issue |
| `/flow/sync` | Sync branch with main |
| `/flow/clean` | Clean up stale branches and worktrees |
| `/flow/standup` | Generate standup summary |
| `/flow/update` | Post progress update to issue |

#### Skills

Automatically invoked by Claude when relevant:

| Skill | Triggers |
|-------|----------|
| **issue-context** | "the issue", "the ticket", "requirements", "what am I working on" |
| **pr-context** | "the PR", "CI status", "checks", "reviews" |

#### Requirements

- [GitHub CLI](https://cli.github.com/) (`gh`) installed and authenticated
- [Linear MCP server](https://github.com/anthropics/linear-mcp) configured

## Development

```bash
npm install
npm run dev        # SvelteKit dev server with HMR on :3420
npm run build      # Production build
npm start          # Run production server
```

To test the daemon locally:

```bash
node cli.js open --no-browser
node cli.js list
node cli.js stop
```
