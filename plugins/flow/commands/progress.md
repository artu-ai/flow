---
description: Show progress and todos from the current Linear issue
argument-hint: [issue-id]
allowed-tools: Bash(git branch *), mcp__claude_ai_Linear__get_issue
---

# Issue Progress

Display the progress and todos from the current Linear issue's description.

## Context

- Current branch: !`git branch --show-current`

## Arguments

- **Issue ID**: `$1` - The Linear issue ID (e.g., "ABC-123"). If not provided, infer from the branch name.

## Step 1: Get the Issue ID

If `$1` is provided:

- Use it as the issue ID

If `$1` is empty:

- Extract the issue ID from the branch name (Linear branches typically follow the format `username/abc-123-description`)
- Look for a pattern like `ABC-123` (letters-numbers) in the branch name

If no issue ID can be determined (branch name doesn't match Linear `ABC-123` pattern):

- Output and stop:
  > **This command requires a Linear issue.**
  >
  > Your branch doesn't appear to be linked to a Linear issue. Provide an issue ID: `/flow:progress ABC-123`
  >
  > This command uses Linear issue checkboxes to display progress. It is not available for plain branches.

## Step 2: Fetch Issue Details

Use `get_issue` to fetch the issue title and description.

## Step 3: Extract and Display Progress

Parse the description for checkboxes and display progress:

```
Issue: <issue-id> - <title>

Progress: X/Y completed

Completed:
  ✓ Task that is done
  ✓ Another completed task

Remaining:
  ○ Task still to do
  ○ Another pending task

Canceled:
  ✗ Task that was canceled (strikethrough)
```

Checkbox patterns to look for:

- `- [x]` or `- [X]` → Completed (✓)
- `- [ ]` → Remaining (○)
- `- ~~text~~` or `~~ - [ ] text~~` → Canceled (✗)

If no checkboxes found:

```
Issue: <issue-id> - <title>

No progress checkboxes found in issue description.
```
