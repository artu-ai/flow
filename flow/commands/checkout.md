---
description: Checkout a branch for a Linear issue
argument-hint: [issue-id]
allowed-tools: mcp__plugin_linear_linear__get_issue, mcp__plugin_linear_linear__update_issue, Bash(git worktree:*), Bash(git push:*), Bash(git rev-parse:*), Bash(basename:*)
---

# Checkout Linear Issue Branch

Create a worktree and branch for a Linear issue, enabling parallel development.

## Arguments

- **Issue ID**: `$1` - The Linear issue ID or identifier (e.g., "ABC-123"). If not provided, infer from conversation context.

## Step 1: Get the Issue ID

If `$1` is provided:

- Use it as the issue ID

If `$1` is empty or not provided:

- Look through the conversation for a Linear issue ID or identifier (format: `ABC-123` or a UUID)
- If no issue ID can be found, respond with:
  > **No issue ID found.**
  >
  > Please provide an issue ID: `/flow/checkout ABC-123`
  >
  > Or discuss a Linear issue first, then run the command again.

## Step 2: Get Issue Details

Use `get_issue` with the issue ID to retrieve:

- Issue title
- Issue identifier (e.g., "ABC-123")
- Git branch name

If the issue is not found, report the error and stop.

## Step 3: Determine Worktree Path

Get the repository root and name:

```bash
git rev-parse --show-toplevel
```

```bash
basename $(git rev-parse --show-toplevel)
```

The worktree path will be: `<repo-parent>/<repo-name>-<issue-identifier>`

For example, if the repo is at `/Users/alex/Projects/my-app` and the issue is `ABC-123`, the worktree path is `/Users/alex/Projects/my-app-ABC-123`.

## Step 4: Create Worktree and Branch

Check if the worktree already exists:

```bash
git worktree list
```

**If the worktree already exists** for this issue:

- Output the existing worktree path and skip to Step 6

**If the worktree does not exist:**

1. **Create worktree with new branch**:

   ```bash
   git worktree add <worktree-path> -b <branch-name>
   ```

   Use the git branch name from the issue.

2. **Push and set upstream** (from the new worktree):
   ```bash
   git -C <worktree-path> push -u origin <branch-name>
   ```

## Step 5: Update Issue Status

Use `update_issue` to set the issue status to "In Progress".

## Step 6: Output the Result

After completing all steps, output:

```
Worktree: <worktree-path>
Branch: <branch-name>
Issue: <issue-identifier> - <issue-title> (In Progress)

To start working, open a new terminal and run:
  cd <worktree-path>

Run /flow/commit when done to create draft PR.
```

If any step fails, explain the error and what was completed successfully.
