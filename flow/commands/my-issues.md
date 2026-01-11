---
description: List your assigned Linear issues
argument-hint: [status]
allowed-tools: mcp__plugin_linear_linear__list_issues
---

# My Issues

List your assigned Linear issues.

## Arguments

- **Status**: `$1` - Filter by status: "todo", "in-progress", "in-review", "done", or leave empty for all active issues

## Your task

Use `list_issues` with:

- `assignee`: "me"
- `state`: "$1" if provided, otherwise omit to get all active issues
- `includeArchived`: false

## Output Format

Display issues in a clean table format:

```
ID         | Priority | Status      | Title
-----------|----------|-------------|---------------------------
ABC-123    | High     | In Progress | Implement user auth
ABC-124    | Medium   | Todo        | Fix dashboard layout
```

If no issues found, display:

```
No issues assigned to you.
```

Group by status if showing all issues (Todo first, then In Progress, then In Review).
