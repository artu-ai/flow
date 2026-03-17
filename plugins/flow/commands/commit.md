---
disable-model-invocation: true
allowed-tools: Bash(git add *), Bash(git status *), Bash(git commit *), Bash(git branch *), Bash(git log *), Bash(git push *), Bash(git diff *), Bash(gh pr view *), Bash(gh pr create *), Bash(pnpm *), Bash(grep *), mcp__claude_ai_Linear__save_comment, mcp__claude_ai_Linear__get_issue, mcp__claude_ai_Linear__save_issue
description: Create a git commit, create draft PR if needed, and comment on Linear issue
argument-hint: [--no-verify]
---

## Context

- Current git status: !`git status`
- Current git diff (staged and unstaged changes): !`git diff HEAD`
- Current branch: !`git branch --show-current`
- Recent commits: !`git log --oneline -10`
- pnpm available: !`pnpm --version`
- Has lint script: !`grep -c lint package.json`
- Has check-types script: !`grep -c check-types package.json`
- Has check-circular script: !`grep -c check-circular package.json`

## Your task

Based on the above changes:

### Pre-check: Ensure not on main branch

If the current branch is `main` or `master`, **STOP immediately**. Do NOT commit directly to main. Tell the user:

```
You're on the main branch. Please create a feature branch first using `/flow:checkout` or switch to an existing branch before committing.
```

Do NOT proceed with any further steps.

### Step 0: Quality checks

If `$ARGUMENTS` contains `--no-verify`, skip this step entirely.

If pnpm is available and the project has a `package.json`, check for and run these commands:

1. If a `lint` script exists: run `pnpm lint`
2. If a `check-types` script exists: run `pnpm check-types`
3. If a `check-circular` script exists: run `pnpm check-circular`

If either command fails with errors, **STOP immediately**. Report the errors to the user and ask if they want you to fix them before committing. Do NOT proceed with the commit until the user responds.

If pnpm is not available or the scripts don't exist, skip this step.

### Step 1: Create the commit

**Important:** Only stage and commit changes that pertain to the scope of the current session. Do not include unrelated changes, files from other tasks, or changes that were not discussed in this conversation.

Stage the relevant changes and create the commit using a single message. Follow conventional commit format.

Then push the commit:

```bash
git push
```

### Step 2: Get the Issue ID

Extract the issue ID from the branch name (Linear branches typically follow the format `username/abc-123-description`). Look for a pattern like `ABC-123` (letters-numbers) in the branch name.

If no issue ID can be determined, skip the Linear steps and just complete the commit.

### Step 3: Create draft PR if needed

Check if a PR already exists for this branch:

```bash
gh pr view --json url 2>/dev/null
```

If no PR exists (command fails), create a draft PR:

**If an issue ID was found (Linear branch):**

1. Use `get_issue` with the issue ID to get the issue title
2. Create the draft PR:
   ```bash
   gh pr create --draft --title "<issue-title>" --body "Resolves <issue-identifier>"
   ```

**If no issue ID was found (plain branch):**

1. Derive the PR title from the commit message or branch name
2. Create the draft PR:
   ```bash
   gh pr create --draft --title "<derived-title>" --body ""
   ```

If PR already exists, skip this step.

### Step 4: Update progress checkboxes (if available)

**Skip this step entirely if no issue ID was found.**

Use `get_issue` to fetch the issue description. If the description contains progress tracking checkboxes (e.g., `- [ ] Task item`), check off any items that were completed by this commit.

Use `update_issue` to update the description with the checked items:

- `- [ ]` → `- [x]` for completed items

Only update checkboxes for work that was actually completed in this commit. Skip this step if no checkboxes exist.

### Step 5: Add a comment to the Linear issue

**Skip this step entirely if no issue ID was found.**

Use `save_comment` to add a **brief** comment. Keep it minimal - avoid verbose explanations.

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
