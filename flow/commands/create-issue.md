---
description: Create a Linear issue from the current conversation
argument-hint: [project] [assignee] [priority]
allowed-tools: mcp__plugin_linear_linear__list_projects, mcp__plugin_linear_linear__list_users, mcp__plugin_linear_linear__list_issue_labels, mcp__plugin_linear_linear__create_issue
---

# Create Linear Issue

Create a Linear issue based on the current conversation context.

## Arguments

- **Project**: `$1` - Search for a project matching this name
- **Assignee**: `$2` - Search for a user matching this name, or use "me" for self-assignment
- **Priority**: `$3` - Priority level: "urgent", "high", "medium", "low", or "none" (default: none)

## Step 1: Resolve Project, Assignee, and Priority

### Project Resolution

Search for a Linear project that best matches "$1":

1. Use `list_projects` with `query: "$1"` to search for content in the project name
2. Select the project whose name best matches "$1"
3. If no match found, list available projects and ask the user to clarify

### Assignee Resolution

If "$2" is empty, "me", or not provided:

- Use `"me"` as the `assigneeId` (self-assignment, no search needed)

Otherwise, search for a user matching "$2":

1. Use `list_users` with `query: "$2"` to filter users by name or email
2. Select the user whose name best matches "$2"
3. If no match found, list available users and ask the user to clarify

### Priority Resolution

Map "$3" to Linear priority values:

- "urgent" or "1" → `priority: 1`
- "high" or "2" → `priority: 2`
- "medium" or "3" → `priority: 3`
- "low" or "4" → `priority: 4`
- empty, "none", or "0" → do not set priority

### Label Inference

Infer labels from the conversation context. Use `list_issue_labels` to get available labels, then match based on the criteria below.

#### Type Labels (select one)

| Label         | Infer When Conversation Mentions                               |
| ------------- | -------------------------------------------------------------- |
| `Bug`         | "broken", "not working", "error", "fix", "issue with", "crash" |
| `Feature`     | "add", "new", "implement", "create", "build"                   |
| `Improvement` | "improve", "enhance", "better", "optimize", "update"           |
| `Refactor`    | "refactor", "restructure", "clean up", "reorganize"            |
| `Docs`        | "documentation", "readme", "comments", "docs"                  |
| `Chore`       | "dependencies", "maintenance", "config", "upgrade"             |

#### Area Labels (select all that apply)

| Label      | Infer When Conversation Mentions                   |
| ---------- | -------------------------------------------------- |
| `Frontend` | dashboard, UI, components, React, pages, styles    |
| `API`      | backend, endpoints, routes, tRPC, server, API      |
| `Database` | schema, migrations, queries, Drizzle, database, DB |
| `SDK`      | SDK, client library, package                       |
| `Infra`    | deployment, CI, Docker, config, infrastructure     |

Note: If a label doesn't exist in the workspace, Linear will create it automatically.

## Step 2: Analyze the Conversation

### Check for Plan Mode Output

If the conversation contains a plan from Claude's plan mode (i.e., you used EnterPlanMode/ExitPlanMode, or wrote a plan to a plan file), use the **entire plan content** as the issue description. Do not summarize or truncate the plan — include it in full as markdown in the description field. Derive the issue title from the plan's goal or heading. The **only** modification you may make to the plan content is applying the description formatting from Step 2.1 (checkboxes, phases, and subphases).

### Otherwise, Extract from Conversation

Review the conversation to extract:

- **Title**: A clear, concise issue title
- **Description**: Detailed context including the problem, requirements, or feature request
- **Priority**: If mentioned (1=urgent, 2=high, 3=medium, 4=low)
- **Labels**: If applicable based on discussion

You must have at minimum:

1. A clear title that describes the issue
2. A meaningful description with context

If the conversation does NOT contain enough information to create a useful issue, respond with:

> **Not enough context to create an issue.**
>
> Please plan the issue first. I need at least:
>
> - A clear problem statement or feature request
> - Context about what needs to be done
>
> Try discussing what you want to accomplish, and then run `/flow/create-issue $1 $2` again.

Do NOT proceed to create an issue if the context is insufficient.

## Step 2.1: Format Description with Phases and Checkboxes

**This applies to ALL issues** — whether derived from a plan or from conversation analysis.

Structure the description using **phases** as bold headers and **tasks as checkboxes** underneath. Group related work into logical phases. Use sub-checkboxes for subphases or smaller steps within a task.

Example format:

```markdown
Brief context paragraph about the issue.

**Phase 1: Setup and Configuration**
- [ ] Initialize project scaffolding
  - [ ] Create directory structure
  - [ ] Add configuration files
- [ ] Set up dependencies

**Phase 2: Core Implementation**
- [ ] Implement the main feature logic
  - [ ] Add data model
  - [ ] Add service layer
- [ ] Write unit tests

**Phase 3: Integration and Cleanup**
- [ ] Wire up to existing system
- [ ] Update documentation
```

After the phases, add a **dependency graph** that shows the execution order and which phases can be parallelized. Use a simple arrow notation:

```markdown
**Dependency Graph**
Phase 1 → Phase 2
Phase 1 → Phase 3
Phase 2, Phase 3 → Phase 4
```

- `→` means "must complete before"
- Phases listed together with commas (e.g., `Phase 2, Phase 3`) means they can run **in parallel**
- If multiple phases converge into one (e.g., `Phase 2, Phase 3 → Phase 4`), it means Phase 4 is blocked until both are done
- If all phases are strictly sequential, a single chain is fine: `Phase 1 → Phase 2 → Phase 3`

Guidelines:
- Each phase should be a logical grouping of related work (e.g., setup, core implementation, testing, cleanup)
- Use `- [ ]` for top-level tasks, indented `- [ ]` for subtasks
- Keep phase names short and descriptive with a bolded `**Phase N: Name**` format
- A brief context paragraph at the top is fine, but the bulk of the description should be the phased checklist
- For plan mode content: preserve all the detail from the plan — just reorganize it into this phase/checkbox structure

## Step 3: Create the Issue

Use the `create_issue` tool with:

- `teamId`: The team ID from the resolved project
- `title`: Clear, concise issue title from conversation
- `description`: Well-formatted markdown description with context, acceptance criteria, and technical details
- `state`: "Todo" (default status for new issues)
- `assigneeId`: The resolved user ID or `"me"`
- `priority`: The resolved priority from `$3` (1-4), or omit if not specified
- `labels`: Array of inferred label names (e.g., `["Feature", "API"]`)

## Step 4: Output the Result

After creating the issue, output:

```
Issue created: [ISSUE-ID] - [Title]
Project: [Project Name]
Assignee: [Assignee Name]
Labels: [Label1], [Label2]
Link: [URL to the issue]
```

If the creation fails, explain the error and suggest next steps.
