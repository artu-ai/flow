---
description: Cancel work on current issue and close the PR
argument-hint: [reason]
allowed-tools: Bash(gh pr view:*), Bash(gh pr comment:*), Bash(gh pr close:*), Bash(git branch:*), Bash(git worktree:*), Bash(git pull:*), Bash(git rev-parse:*), mcp__plugin_linear_linear__update_issue
---

# Cancel

Cancel work on the current issue, close the PR, and mark the issue as canceled. Cleans up the worktree if one was used.

## Context

- Current branch: !`git branch --show-current`
- Current directory: !`pwd`

## Arguments

- **Reason**: `$ARGUMENTS` - The reason for cancellation (required)

## Step 1: Validate cancellation reason

If `$ARGUMENTS` is empty:

Output and stop:

```
Please provide a cancellation reason: /flow/cancel <reason>

Example: /flow/cancel "Requirements changed, no longer needed"
```

## Step 2: Check PR status

Check if a PR exists for the current branch:

```bash
gh pr view --json state,url,isDraft,baseRefName -q '{state: .state, url: .url, isDraft: .isDraft, baseRefName: .baseRefName}'
```

Save the `baseRefName` - this is the parent branch to checkout later.

**If no PR exists:**

Output and stop:

```
No PR found for this branch.

To cancel just the issue, update it manually in Linear.
```

**If PR is MERGED or CLOSED:**

Output and stop:

```
PR is already <state>: <pr-url>

Cannot cancel a PR that is already merged or closed.
```

**If PR is OPEN (draft or not):**

Continue to Step 3.

## Step 3: Get the Issue ID

Extract the issue ID from the branch name:

- Linear branches typically follow the format `username/abc-123-description`
- Look for a pattern like `ABC-123` (letters-numbers) in the branch name

## Step 4: Add comment and close PR

Add a comment with the cancellation reason:

```bash
gh pr comment --body "Canceled: $ARGUMENTS"
```

Close the PR:

```bash
gh pr close
```

## Step 5: Update Issue Status

If an issue ID was found:

- Use `update_issue` to set `state: "Canceled"`

## Step 6: Check if in a worktree

Determine if the current directory is a worktree (not the main working tree):

```bash
git rev-parse --show-toplevel
```

```bash
git worktree list --porcelain
```

A worktree entry shows `worktree <path>` lines. The main worktree is the first one listed. If the current toplevel matches a non-main worktree path, we're in a worktree.

**If in a worktree:**

1. Save the current worktree path
2. Find the main worktree path (first entry in `git worktree list`)
3. Continue to Step 7 with worktree cleanup

**If NOT in a worktree (main working tree):**

- Skip worktree cleanup, just checkout the base branch

## Step 7: Switch to main worktree and cleanup

**If in a worktree:**

Tell the user to switch directories and provide cleanup command:

```
PR closed: <pr-url>
Reason: <cancellation-reason>
Issue: <issue-id> (marked as Canceled)

You're in a worktree. To complete cleanup:
  1. cd <main-worktree-path>
  2. git pull
  3. git worktree remove <current-worktree-path>

Or run /flow/clean to remove all stale worktrees.
```

**If NOT in a worktree:**

Checkout the base branch and pull latest:

```bash
git checkout <baseRefName> && git pull
```

## Output

**If NOT in a worktree**, after completing:

```
PR closed: <pr-url>
Reason: <cancellation-reason>
Issue: <issue-id> (marked as Canceled)
Checked out: <baseRefName> (up to date)
```

If no issue was found:

```
PR closed: <pr-url>
Reason: <cancellation-reason>
(No Linear issue linked)
Checked out: <baseRefName> (up to date)
```

**If in a worktree**, see Step 7 output above.
