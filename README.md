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

#### Commands

| Command | Description |
|---------|-------------|
| `/flow:checkout [issue-id]` | Create and checkout a branch for a Linear issue, set status to "In Progress" |
| `/flow:commit [issue-id]` | Commit changes, create draft PR if needed, comment on Linear issue |
| `/flow:commit-leftovers` | Commit remaining changes not related to current issue |
| `/flow:create-issue` | Create a new Linear issue with description and acceptance criteria |
| `/flow:done` | Mark issue as done, mark PR ready for review |
| `/flow:draft` | Convert PR back to draft status |
| `/flow:ready` | Mark PR as ready for review |
| `/flow:cancel` | Cancel current work, close PR, reset issue status |
| `/flow:my-issues` | List your assigned Linear issues |
| `/flow:next-issue` | Pick up the next prioritized issue from backlog |
| `/flow:progress` | Show current issue and PR status |
| `/flow:continue` | Resume work on an in-progress issue |
| `/flow:sync` | Sync branch with main, rebase if needed |
| `/flow:clean` | Clean up merged branches locally |

#### Skills

These skills are automatically invoked by Claude when relevant:

| Skill | Triggers |
|-------|----------|
| **issue-context** | "the issue", "the ticket", "requirements", "what am I working on" |
| **pr-context** | "the PR", "CI status", "checks", "reviews" |

#### Requirements

- [GitHub CLI](https://cli.github.com/) (`gh`) installed and authenticated
- [Linear MCP server](https://github.com/anthropics/linear-mcp) configured
