---
description: Move PR from draft to open and update Linear issue
argument-hint: [issue-id]
allowed-tools: Bash(gh pr ready:*), Bash(gh pr view:*), Bash(git branch:*), mcp__plugin_linear_linear__create_comment
---

# Mark PR Ready for Review

Convert the current PR from draft to ready for review and add a comment to the Linear issue.

## Context

- Current branch: !`git branch --show-current`

## Arguments

- **Issue ID**: `$1` - The Linear issue ID (e.g., "ABC-123"). If not provided, infer from the branch name.

## Your task

### Step 1: Mark PR as ready

Use the GitHub CLI to convert the draft PR to ready for review:

```bash
gh pr ready
```

If the command fails (e.g., PR doesn't exist or isn't a draft), report the error and stop.

### Step 2: Get PR details

Get the PR URL for the comment:

```bash
gh pr view --json url -q .url
```

### Step 3: Get the Issue ID

If `$1` is provided:

- Use it as the issue ID

If `$1` is empty:

- Extract the issue ID from the branch name (Linear branches typically follow the format `username/abc-123-description`)
- Look for a pattern like `ABC-123` (letters-numbers) in the branch name

If no issue ID can be determined:

- Skip the Linear comment step

### Step 4: Add a comment to the Linear issue

Use `create_comment` to add a comment to the issue:

```
PR opened and ready for review: <pr-url>

Status: In Testing
```

## Output

After completing:

```
PR ready: <pr-url>
Issue: <issue-id> (comment added)
```

If no issue was found:

```
PR ready: <pr-url>
(No Linear issue linked)
```
