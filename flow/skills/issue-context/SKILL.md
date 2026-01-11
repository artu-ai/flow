---
name: issue-context
description: Fetch the current Linear issue's description and plan for context. Use when you need to understand what you're working on, the requirements for the current task, the acceptance criteria, or when the user mentions "the issue", "the ticket", "the task", or asks about the current work context.
allowed-tools: Bash(git branch:*), mcp__plugin_linear_linear__get_issue
---

# Issue Context

This skill retrieves the current Linear issue's details to provide context about the work being done.

## When to Use

- When you need to understand the requirements for the current task
- When the user asks about "the issue", "the ticket", or "the plan"
- When you need acceptance criteria or specifications
- When starting work and need to understand the scope
- When the user asks "what am I working on?" or "what's the context?"

## How to Get the Issue ID

### Option 1: From the current branch name

Get the current branch:

```bash
git branch --show-current
```

Linear branch names typically follow the format:

- `username/abc-123-description`
- `abc-123-description`

Extract the issue identifier (e.g., `ABC-123`) using a pattern like letters-numbers.

### Option 2: From conversation context

If an issue ID was mentioned in the conversation, use that.

## Fetching Issue Details

Use the `get_issue` tool with the issue ID:

```
get_issue(id: "ABC-123")
```

This returns:

- **Title**: The issue title
- **Description**: Full description with requirements, acceptance criteria, technical details
- **State**: Current status (Todo, In Progress, etc.)
- **Priority**: Issue priority
- **Labels**: Applied labels
- **Assignee**: Who's assigned
- **Project**: Parent project
- **Branch name**: Git branch name

## Providing Context

After fetching, summarize the relevant parts based on what the user needs:

- For understanding scope: Focus on title and description
- For implementation: Focus on description, acceptance criteria, technical details
- For status check: Focus on state, priority, assignee

## Example Output

```
Issue: ABC-123 - Implement user authentication

Description:
Add JWT-based authentication to the API with the following requirements:
- Login endpoint with email/password
- Token refresh mechanism
- Logout endpoint that invalidates tokens

Acceptance Criteria:
- [ ] Users can log in with valid credentials
- [ ] Tokens expire after 24 hours
- [ ] Refresh tokens work correctly

Status: In Progress
Priority: High
```
