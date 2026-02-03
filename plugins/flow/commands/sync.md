---
description: Sync progress checkboxes in Linear issue based on completed work
argument-hint: [issue-id]
allowed-tools: Bash(git branch:*), Bash(git log:*), Bash(git diff:*), mcp__plugin_linear_linear__get_issue, mcp__plugin_linear_linear__update_issue
---

# Sync Progress

Analyze completed work and update the Linear issue's progress checkboxes accordingly.

## Context

- Current branch: !`git branch --show-current`
- Recent commits on this branch: !`git log --oneline -20`

## Arguments

- **Issue ID**: `$1` - The Linear issue ID (e.g., "ABC-123"). If not provided, infer from the branch name.

## Step 1: Get the Issue ID

If `$1` is provided:

- Use it as the issue ID

If `$1` is empty:

- Extract the issue ID from the branch name (Linear branches typically follow the format `username/abc-123-description`)
- Look for a pattern like `ABC-123` (letters-numbers) in the branch name

If no issue ID can be determined:

- Output error and stop:
  > **No issue ID found.**
  >
  > Please provide an issue ID: `/flow/sync ABC-123`

## Step 2: Fetch Issue Details

Use `get_issue` to fetch the issue description containing checkboxes.

If no checkboxes found, output:

```
No progress checkboxes found in issue description.
```

## Step 3: Analyze Completed Work

Review the conversation history and recent commits to determine:

- What tasks have been completed
- What tasks are no longer going to be done (scope changed, not needed, etc.)

## Step 4: Update Checkboxes

Use `update_issue` to update the description:

**For completed items:**

- Change `- [ ] Task` → `- [x] Task`

**For canceled items (won't be done):**

- Change `- [ ] Task` → `- [ ] ~~Task~~`

**Important:**

- Only mark items as complete if they were actually done
- Only cancel items if explicitly discussed as not needed
- Preserve all other content in the description unchanged

## Step 5: Output Summary

```
Issue: <issue-id> - <title>

Updated checkboxes:
  ✓ Marked complete: <task description>
  ✗ Marked canceled: <task description>

Progress: X/Y completed, Z canceled
```

If no changes needed:

```
Issue: <issue-id> - <title>

All checkboxes already up to date.
```
