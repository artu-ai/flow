---
description: Convert open PR back to draft
allowed-tools: Bash(gh pr ready:*), Bash(gh pr view:*)
---

# Convert PR to Draft

Move the current PR from open back to draft status.

## Step 1: Check PR status

Check if a PR exists and its current state:

```bash
gh pr view --json state,isDraft,url -q '{state: .state, isDraft: .isDraft, url: .url}'
```

**If no PR exists:**

Output and stop:

```
No PR found for this branch.
```

**If PR is already a draft:**

Output and stop:

```
PR is already a draft: <pr-url>
```

**If PR is merged or closed:**

Output and stop:

```
Cannot convert to draft - PR is <state>: <pr-url>
```

**If PR is open (not draft):**

Continue to Step 2.

## Step 2: Convert to draft

```bash
gh pr ready --undo
```

## Output

After completing:

```
PR converted to draft: <pr-url>
```
