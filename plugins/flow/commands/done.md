---
description: Complete work on current issue after PR is merged
argument-hint: [issue-id]
allowed-tools: Bash(gh pr view:*), Bash(git branch:*), Bash(git worktree:*), Bash(git pull:*), Bash(git rev-parse:*), Bash(cd:*), Bash(ls:*), Bash(ln:*), Bash(for:*), Bash(echo:*), Bash(basename:*), Bash(sed:*), mcp__plugin_linear_linear__get_issue, mcp__plugin_linear_linear__update_issue
---

# Done

Complete work on the current issue after the PR has been merged. Cleans up the worktree if one was used.

## Context

- Current branch: !`git branch --show-current`
- Current directory: !`pwd`

## Arguments

- **Issue ID**: `$1` - The Linear issue ID (e.g., "ABC-123"). If not provided, infer from the branch name.

## Step 1: Check if PR is merged

Check the PR status for the current branch:

```bash
gh pr view --json state,url,baseRefName -q '{state: .state, url: .url, baseRefName: .baseRefName}'
```

Save the `baseRefName` - this is the parent branch to checkout later.

**If PR is NOT merged** (state is not "MERGED"):

Output and stop:

```
PR not merged yet: <pr-url>

Please merge the PR first, then run /flow/done again.
```

Do not proceed to the next steps.

**If PR is merged** (state is "MERGED"):

Continue to Step 2.

## Step 2: Get the Issue ID

If `$1` is provided:

- Use it as the issue ID

If `$1` is empty:

- Extract the issue ID from the branch name (Linear branches typically follow the format `username/abc-123-description`)
- Look for a pattern like `ABC-123` (letters-numbers) in the branch name

## Step 3: Update Issue Status

Use `get_issue` to check the current issue status.

If the issue status is NOT "Done":

- Use `update_issue` to set `state: "Done"`

If the issue is already "Done":

- Skip this step

## Step 4: Check if in a worktree

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
3. Continue to Step 5 to preserve Claude conversations, then Step 6 with worktree cleanup

**If NOT in a worktree (main working tree):**

- Skip worktree cleanup, just checkout the base branch (skip to Step 6)

## Step 5: Preserve Claude conversations (worktree only)

When in a worktree, create symlinks to preserve access to Claude conversations after the worktree is deleted.

1. Convert the worktree path to Claude project directory name (replace `/` with `-`):

```bash
worktree_claude_dir=$(echo "<current-worktree-path>" | sed 's|/|-|g')
```

2. Convert the main worktree path to Claude project directory name:

```bash
main_claude_dir=$(echo "<main-worktree-path>" | sed 's|/|-|g')
```

3. Check if the worktree Claude projects directory exists:

```bash
ls ~/.claude/projects/${worktree_claude_dir}/ 2>/dev/null
```

4. If the directory exists, create symlinks for each conversation:

```bash
for item in ~/.claude/projects/${worktree_claude_dir}/*; do
  target=~/.claude/projects/${main_claude_dir}/$(basename "$item")
  if [ ! -e "$target" ]; then
    ln -s "$item" "$target"
    echo "Linked: $(basename "$item")"
  else
    echo "Skipping $(basename "$item") - already exists"
  fi
done
```

This ensures conversations from the worktree remain accessible from the main worktree after cleanup.

## Step 6: Switch to main worktree and cleanup

**If in a worktree:**

Tell the user to switch directories and provide cleanup command:

```
PR merged: <pr-url>
Issue: <issue-id> (marked as Done)
Claude conversations: linked to main worktree

You're in a worktree. To complete cleanup:
  1. cd <main-worktree-path>
  2. git pull
  3. git worktree remove <current-worktree-path>

Or run /flow/clean to remove all stale worktrees.
```

If no conversations were found to link, omit the "Claude conversations" line.

**If NOT in a worktree:**

Checkout the base branch and pull latest:

```bash
git checkout <baseRefName> && git pull
```

## Output

**If NOT in a worktree**, after completing:

```
PR merged: <pr-url>
Issue: <issue-id> (marked as Done)
Checked out: <baseRefName> (up to date)
```

If issue was already Done:

```
PR merged: <pr-url>
Issue: <issue-id> (already Done)
Checked out: <baseRefName> (up to date)
```

If no issue was found:

```
PR merged: <pr-url>
(No Linear issue linked)
Checked out: <baseRefName> (up to date)
```

**If in a worktree**, see Step 6 output above.
