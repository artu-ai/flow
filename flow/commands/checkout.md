---
description: Checkout a branch for a Linear issue
argument-hint: [issue-id]
allowed-tools: mcp__plugin_linear_linear__get_issue, mcp__plugin_linear_linear__update_issue, Bash(git checkout:*), Bash(git push:*)
---

# Checkout Linear Issue Branch

Create and push a branch for a Linear issue.

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
- Git branch name

If the issue is not found, report the error and stop.

## Step 3: Create and Checkout Branch

Execute the following git commands:

1. **Checkout new branch** from current branch:

   ```bash
   git checkout -b <branch-name>
   ```

   Use the git branch name from the issue.

2. **Push and set upstream**:
   ```bash
   git push -u origin <branch-name>
   ```

## Step 4: Update Issue Status

Use `update_issue` to set the issue status to "In Progress".

## Step 5: Output the Result

After completing all steps, output:

```
Branch: <branch-name>
Issue: <issue-identifier> - <issue-title> (In Progress)

Ready to start coding. Run /flow/commit when done to create draft PR.
```

If any step fails, explain the error and what was completed successfully.
