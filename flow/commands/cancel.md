---
description: Cancel work on current issue and close the PR
argument-hint: [reason]
allowed-tools: Bash(gh pr view:*), Bash(gh pr comment:*), Bash(gh pr close:*), Bash(git branch:*), Bash(git checkout:*), Bash(git pull:*), mcp__plugin_linear_linear__update_issue
---

# Cancel

Cancel work on the current issue, close the PR, and mark the issue as canceled.

## Context

- Current branch: !`git branch --show-current`

## Arguments

- **Reason**: `$ARGUMENTS` - The reason for cancellation (required)

## Step 1: Validate cancellation reason

If `$ARGUMENTS` is empty:

Output and stop:

```
Please provide a cancellation reason: /flow/cancel <reason>

Example: /flow/cancel "Requirements changed, no longer needed"
```

## Step 2: Check PR status

Check if a PR exists for the current branch:

```bash
gh pr view --json state,url,isDraft,baseRefName -q '{state: .state, url: .url, isDraft: .isDraft, baseRefName: .baseRefName}'
```

Save the `baseRefName` - this is the parent branch to checkout later.

**If no PR exists:**

Output and stop:

```
No PR found for this branch.

To cancel just the issue, update it manually in Linear.
```

**If PR is MERGED or CLOSED:**

Output and stop:

```
PR is already <state>: <pr-url>

Cannot cancel a PR that is already merged or closed.
```

**If PR is OPEN (draft or not):**

Continue to Step 3.

## Step 3: Get the Issue ID

Extract the issue ID from the branch name:

- Linear branches typically follow the format `username/abc-123-description`
- Look for a pattern like `ABC-123` (letters-numbers) in the branch name

## Step 4: Add comment and close PR

Add a comment with the cancellation reason:

```bash
gh pr comment --body "Canceled: $ARGUMENTS"
```

Close the PR:

```bash
gh pr close
```

## Step 5: Update Issue Status

If an issue ID was found:

- Use `update_issue` to set `state: "Canceled"`

## Step 6: Checkout parent branch and pull

Checkout the base branch (from Step 2) and pull latest:

```bash
git checkout <baseRefName> && git pull
```

## Output

After completing:

```
PR closed: <pr-url>
Reason: <cancellation-reason>
Issue: <issue-id> (marked as Canceled)
Checked out: <baseRefName> (up to date)
```

If no issue was found:

```
PR closed: <pr-url>
Reason: <cancellation-reason>
(No Linear issue linked)
Checked out: <baseRefName> (up to date)
```
