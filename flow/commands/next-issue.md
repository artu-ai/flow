---
description: Recommend which issue to tackle next from your backlog
allowed-tools: mcp__plugin_linear_linear__list_issues, mcp__plugin_linear_linear__get_issue
---

# Next Issue

Analyze your assigned issues and recommend which one to work on next.

## Step 1: Fetch Available Issues

Use `list_issues` with:

- `assignee`: "me"
- `includeArchived`: false

Filter to only issues with status **"Todo"** or **"Backlog"**. Exclude all other statuses (In Progress, Done, Canceled, etc.).

## Step 2: Analyze and Score Issues

For each issue, consider these factors:

### Priority (highest weight)

- Urgent (1): Critical, handle immediately
- High (2): Important, should be done soon
- Medium (3): Normal priority
- Low (4): Can wait
- No priority: Treat as medium

### Due Date

- Overdue: Highest urgency
- Due within 3 days: High urgency
- Due within 1 week: Medium urgency
- Due later or no date: Lower urgency

### Labels

- `Bug`: Often more urgent than features
- `Blocker`: Unblocks other work
- `Quick Win` / `Small`: Easy momentum builders

### Status (high weight)

- `Todo`: Ready to start, higher priority
- `Backlog`: Lower priority, needs to be pulled into Todo first

## Step 3: Output Recommendations

```
Available issues: X total (Y Todo, Z Backlog)

Recommended next:
  → <ISSUE-ID> - <title>
    Priority: <priority> | Due: <due date or "No date"> | Status: <status>
    <brief reasoning why this is recommended>

Alternatives:
  • <ISSUE-ID> - <title> (<brief reason>)
  • <ISSUE-ID> - <title> (<brief reason>)
```

If no available issues:

```
No Todo or Backlog issues assigned to you.

Run /flow/create-issue to create a new one, or check /flow/my-issues for other statuses.
```

## Example Output

```
Available issues: 4 total (3 Todo, 1 Backlog)

Recommended next:
  → ART-45 - Fix authentication timeout bug
    Priority: High | Due: Tomorrow | Status: Todo
    High priority bug with imminent due date.

Alternatives:
  • ART-52 - Add dark mode support (Todo, Medium priority, due in 5 days)
  • ART-48 - Update API documentation (Todo, Quick win)

Backlog:
  • ART-58 - Offer free AV diagnosis (Backlog, no priority)
```
