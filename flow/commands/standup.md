---
description: Generate a standup summary from your recent Linear activity
argument-hint: [morning|evening]
allowed-tools: mcp__plugin_linear_linear__list_issues, mcp__plugin_linear_linear__get_user, Bash(date:*), Bash(TZ=*:*)
---

# Daily Standup Summary

Generate a standup message summarizing your Linear activity for team communication.

## Standup Windows (Mexico City Time)

- **Morning standup (10 AM)**: Work done from 6 PM yesterday to 10 AM today
- **Evening standup (6 PM)**: Work done from 10 AM to 6 PM today

## Arguments

- **Standup type**: `$1` - Optional. Either `morning` or `evening`. If not provided, infer from current time.

## Step 1: Determine Standup Type

Get current time in Mexico City timezone:

```bash
TZ="America/Mexico_City" date "+%H"
```

**If `$1` is provided:**

- Use `morning` or `evening` as specified

**If `$1` is empty:**

- If current hour is 6-13 (6 AM to 1 PM): assume **morning** standup
- If current hour is 14-23 or 0-5 (2 PM to 5 AM): assume **evening** standup

## Step 2: Calculate Time Window

Get the ISO-8601 timestamps for the time window:

**For morning standup:**

```bash
TZ="America/Mexico_City" date -v-1d -v18H -v0M -v0S "+%Y-%m-%dT%H:%M:%S"
```

This gives 6 PM yesterday as the start time.

**For evening standup:**

```bash
TZ="America/Mexico_City" date -v10H -v0M -v0S "+%Y-%m-%dT%H:%M:%S"
```

This gives 10 AM today as the start time.

## Step 3: Get User Info

Use `get_user` with query "me" to get the current user's name and ID.

## Step 4: Fetch Updated Issues

Use `list_issues` with:

- `assignee`: "me"
- `updatedAt`: The ISO-8601 timestamp from Step 2 (e.g., `-P1D` format or the calculated timestamp)
- `limit`: 50

This returns issues you've updated within the time window.

## Step 5: Categorize Issues

Group the issues by what happened to them:

1. **Completed**: Issues where status type is "completed" or "done"
2. **In Progress**: Issues currently being worked on
3. **Started**: Issues that were moved to "In Progress" during the window
4. **Updated**: Other issues that were modified (comments, description changes, etc.)

## Step 6: Generate Standup Message

Create a concise standup message in this format:

```
**[Morning/Evening] Standup - [Date]**

✅ **Completed:**
- [ISSUE-123] Brief issue title
- [ISSUE-456] Brief issue title

🔄 **In Progress:**
- [ISSUE-789] Brief issue title - what you're working on

📝 **Updated:**
- [ISSUE-012] Brief issue title - what changed

**Next up:** [Brief description of what you'll focus on next]
```

**Guidelines for the message:**

- Keep issue descriptions brief (one line each)
- Focus on outcomes, not tasks
- Use the issue identifier as a link reference
- If no activity in a category, omit that section
- Add a "Next up" suggestion based on in-progress items or recent patterns

## Step 7: Output

Present the standup message and ask if the user wants to adjust anything before copying it.

```
Here's your standup summary for the [morning/evening] standup:

[Generated message]

---
Feel free to copy this message or let me know if you'd like any adjustments.
```
