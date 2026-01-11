---
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*), Bash(git branch:*), Bash(git log:*), Bash(git push:*), Bash(gh pr view:*), Bash(gh pr create:*), mcp__plugin_linear_linear__create_comment, mcp__plugin_linear_linear__get_issue, mcp__plugin_linear_linear__update_issue
description: Create a git commit, create draft PR if needed, and comment on Linear issue
argument-hint: [issue-id]
---

## Context

- Current git status: !`git status`
- Current git diff (staged and unstaged changes): !`git diff HEAD`
- Current branch: !`git branch --show-current`
- Recent commits: !`git log --oneline -10`

## Arguments

- **Issue ID**: `$1` - The Linear issue ID (e.g., "ABC-123"). If not provided, infer from the branch name.

## Your task

Based on the above changes:

### Step 1: Create the commit

**Important:** Only stage and commit changes that pertain to the scope of the current session. Do not include unrelated changes, files from other tasks, or changes that were not discussed in this conversation.

Stage the relevant changes and create the commit using a single message. Follow conventional commit format.

Then push the commit:

```bash
git push
```

### Step 2: Get the Issue ID

If `$1` is provided:

- Use it as the issue ID

If `$1` is empty:

- Extract the issue ID from the branch name (Linear branches typically follow the format `username/abc-123-description`)
- Look for a pattern like `ABC-123` (letters-numbers) in the branch name

If no issue ID can be determined:

- Skip the Linear comment step and just complete the commit

### Step 3: Create draft PR if needed

Check if a PR already exists for this branch:

```bash
gh pr view --json url 2>/dev/null
```

If no PR exists (command fails), create a draft PR:

1. Use `get_issue` with the issue ID to get the issue title
2. Create the draft PR:
   ```bash
   gh pr create --draft --title "<issue-title>" --body "Resolves <issue-identifier>"
   ```

If PR already exists, skip this step.

### Step 4: Update progress checkboxes (if available)

Use `get_issue` to fetch the issue description. If the description contains progress tracking checkboxes (e.g., `- [ ] Task item`), check off any items that were completed by this commit.

Use `update_issue` to update the description with the checked items:

- `- [ ]` → `- [x]` for completed items

Only update checkboxes for work that was actually completed in this commit. Skip this step if no checkboxes exist.

### Step 5: Add a comment to the Linear issue

Use `create_comment` to add a **brief** comment. Keep it minimal - avoid verbose explanations.

Format:

```
<commit-message> (`<short-hash>`)
```

If PR was just created, add on a new line:

```
PR: <pr-url>
```

## Output

After completing:

```
Committed: <short-hash> <commit-message>
PR: <pr-url> (created) or (exists)
Issue: <issue-id> (comment added, checkboxes updated)
Link: <issue-url>
```

If no checkboxes were updated:

```
Committed: <short-hash> <commit-message>
PR: <pr-url> (created) or (exists)
Issue: <issue-id> (comment added)
Link: <issue-url>
```

If no issue was found:

```
Committed: <short-hash> <commit-message>
(No Linear issue linked)
```
