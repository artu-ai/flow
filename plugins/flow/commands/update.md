---
description: Fetch the latest changes from main and merge them into the current branch
allowed-tools: Bash(git fetch:*), Bash(git merge:*), Bash(git status:*), Bash(git branch:*), Bash(git diff:*), Bash(git rev-parse:*)
---

# Update Branch from Main

Fetch the latest changes from main and merge them into the current branch.

## Context

- Current branch: !`git branch --show-current`
- Current status: !`git status --short`

## Step 1: Validate Current Branch

Check the current branch:

```bash
git branch --show-current
```

If on `main` or `master`:

- Output warning and stop:
  > **Already on main branch.**
  >
  > This command is for updating feature branches with the latest changes from main.

## Step 2: Check for Uncommitted Changes

Check git status:

```bash
git status --short
```

If there are uncommitted changes:

- Output warning and stop:
  > **Uncommitted changes detected.**
  >
  > Please commit or stash your changes before updating:
  > - Run `/flow/commit` to commit your changes
  > - Or run `git stash` to temporarily stash them

## Step 3: Fetch Latest from Origin

Fetch the latest changes:

```bash
git fetch origin main
```

If fetch fails (e.g., no remote, network error):

- Report the error and stop

## Step 4: Check if Update is Needed

Check if the branch is already up to date:

```bash
git rev-parse HEAD
git rev-parse origin/main
git merge-base HEAD origin/main
```

If `origin/main` is an ancestor of HEAD (merge-base equals origin/main):

- Output and stop:
  > **Already up to date.**
  >
  > Your branch already contains all changes from main.

## Step 5: Merge origin/main

Perform the merge:

```bash
git merge origin/main --no-edit
```

## Step 6: Report Result

**If merge succeeded:**

```
Branch updated successfully.

Merged origin/main into <branch-name>.
```

**If merge has conflicts:**

```
Merge conflicts detected.

Conflicting files:
  - <file1>
  - <file2>

To resolve:
1. Open the conflicting files and resolve the conflicts
2. Stage the resolved files: git add <file>
3. Complete the merge: git commit

To abort the merge: git merge --abort
```

List the conflicting files using:

```bash
git diff --name-only --diff-filter=U
```
