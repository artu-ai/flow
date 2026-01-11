---
description: Complete work on current issue after PR is merged
argument-hint: [issue-id]
allowed-tools: Bash(gh pr view:*), Bash(git branch:*), Bash(git checkout:*), Bash(git pull:*), mcp__plugin_linear_linear__get_issue, mcp__plugin_linear_linear__update_issue
---

# Done

Complete work on the current issue after the PR has been merged.

## Context

- Current branch: !`git branch --show-current`

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

## Step 4: Checkout parent branch and pull

Checkout the base branch (from Step 1) and pull latest:

```bash
git checkout <baseRefName> && git pull
```

## Output

After completing:

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
