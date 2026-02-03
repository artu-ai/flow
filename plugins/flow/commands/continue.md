---
description: Show progress and recommend next todo(s) to tackle
argument-hint: [issue-id]
allowed-tools: Bash(git branch:*), mcp__plugin_linear_linear__get_issue
---

# Continue

Display issue progress and recommend the next task(s) to work on.

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

If no issue ID can be determined:

- Output error and stop:
  > **No issue ID found.**
  >
  > Please provide an issue ID: `/flow/continue ABC-123`

## Step 2: Fetch Issue Details

Use `get_issue` to fetch the issue title and description.

## Step 3: Display Progress

Parse the description for checkboxes and display current progress:

```
Issue: <issue-id> - <title>

Progress: X/Y completed

Completed:
  ✓ Task that is done
  ✓ Another completed task

Remaining:
  ○ Task still to do
  ○ Another pending task
```

If no checkboxes found:

```
Issue: <issue-id> - <title>

No progress checkboxes found in issue description.
```

Then stop (no recommendations without checkboxes).

## Step 4: Recommend Next Task(s)

Analyze the remaining (uncompleted, non-canceled) tasks and recommend what to work on next.

**Consider these factors when prioritizing:**

1. **Dependencies**: Tasks that unblock other tasks should come first
2. **Logical order**: Setup/foundation tasks before implementation tasks
3. **Complexity**: Sometimes easier wins first build momentum
4. **Related work**: Group related tasks that make sense to do together

**Output format:**

```
Recommended next:
  → <primary recommendation with brief reasoning>

Alternatives:
  • <alternative 1 if applicable>
  • <alternative 2 if applicable>
```

If only one task remains:

```
Last remaining task:
  → <the task>
```

If all tasks are complete:

```
All tasks completed! 🎉

Run /flow/ready to mark the PR ready for review.
```

## Example Output

```
Issue: ART-60 - Add Excel/CSV file upload feature

Progress: 3/7 completed

Completed:
  ✓ Set up file upload component
  ✓ Add CSV parsing logic
  ✓ Create upload API endpoint

Remaining:
  ○ Add Excel parsing support
  ○ Implement validation errors UI
  ○ Add progress indicator
  ○ Write tests

Recommended next:
  → Add Excel parsing support (completes the parsing layer before moving to UI)

Alternatives:
  • Implement validation errors UI (if you want to finalize the CSV flow first)
  • Write tests (if you prefer test-driven approach for remaining features)
```
