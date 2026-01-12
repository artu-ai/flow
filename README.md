# claude-plugins

Shared Claude Code plugins for the team.

## Installation

Load a plugin with the `--plugin-dir` flag:

```bash
claude --plugin-dir ./flow
```

## Plugins

### flow

Linear + GitHub workflow automation for managing issues, branches, commits, and PRs.

Supports **parallel development** using git worktrees - work on multiple issues simultaneously without stashing or switching branches.

#### Commands

| Command | Description |
|---------|-------------|
| `/flow:checkout [issue-id]` | Create a worktree and branch for a Linear issue, enabling parallel development |
| `/flow:commit [issue-id]` | Commit changes, create draft PR if needed, comment on Linear issue |
| `/flow:commit-leftovers` | Commit remaining changes not related to current issue |
| `/flow:create-issue` | Create a new Linear issue with description and acceptance criteria |
| `/flow:done` | Complete issue after PR merge, clean up worktree |
| `/flow:draft` | Convert PR back to draft status |
| `/flow:ready` | Mark PR as ready for review |
| `/flow:cancel` | Cancel current work, close PR, clean up worktree |
| `/flow:my-issues` | List your assigned Linear issues |
| `/flow:next-issue` | Pick up the next prioritized issue from backlog |
| `/flow:progress` | Show current issue and PR status |
| `/flow:continue` | Resume work on an in-progress issue |
| `/flow:sync` | Sync branch with main, rebase if needed |
| `/flow:clean` | Clean up stale branches and worktrees |

#### Parallel Development Workflow

```bash
# Start first issue (creates worktree at ../my-repo-ABC-123)
/flow:checkout ABC-123
# Open new terminal: cd ../my-repo-ABC-123

# Start second issue without losing context (creates ../my-repo-ABC-456)
/flow:checkout ABC-456
# Open another terminal: cd ../my-repo-ABC-456

# Work on either issue in their respective directories
# When done, run /flow:done from the worktree, then /flow:clean to remove it
```

#### Skills

These skills are automatically invoked by Claude when relevant:

| Skill | Triggers |
|-------|----------|
| **issue-context** | "the issue", "the ticket", "requirements", "what am I working on" |
| **pr-context** | "the PR", "CI status", "checks", "reviews" |

#### Requirements

- [GitHub CLI](https://cli.github.com/) (`gh`) installed and authenticated
- [Linear MCP server](https://github.com/anthropics/linear-mcp) configured
