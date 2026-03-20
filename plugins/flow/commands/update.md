---
disable-model-invocation: true
description: Fetch the latest changes from staging (or main with --main) and merge them into the current branch
allowed-tools: Bash(git fetch *), Bash(git merge *), Bash(git merge-base *), Bash(git status *), Bash(git branch *), Bash(git diff *), Bash(git rev-parse *)
argument-hint: [--main]
---

# Update Branch from Upstream

Fetch the latest changes from the upstream branch and merge them into the current branch.

## Context

- Current branch: !`git branch --show-current`
- Current status: !`git status --short`
- Arguments: `$ARGUMENTS`

## Determine Source Branch

- If arguments above is `--main`: source branch is `main`
- If arguments above is empty: source branch is `staging`

## Step 1: Validate Current Branch

Check the current branch:

```bash
git branch --show-current
```

If on the source branch (e.g., on `staging` when updating from staging, or on `main` when using `--main`):

- Output warning and stop:
  > **Already on the source branch.**
  >
  > This command is for updating feature branches with the latest changes from <source-branch>.

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
  > - Run `/flow:commit` to commit your changes
  > - Or run `git stash` to temporarily stash them

## Step 3: Fetch Latest from Origin

Fetch the latest changes:

```bash
git fetch origin <source-branch>
```

If fetch fails (e.g., no remote, network error):

- Report the error and stop

## Step 4: Check if Update is Needed

Check if the branch is already up to date:

```bash
git rev-parse HEAD
git rev-parse origin/<source-branch>
git merge-base HEAD origin/<source-branch>
```

If `origin/<source-branch>` is an ancestor of HEAD (merge-base equals origin/<source-branch>):

- Output and stop:
  > **Already up to date.**
  >
  > Your branch already contains all changes from <source-branch>.

## Step 5: Merge origin/<source-branch>

Perform the merge:

```bash
git merge origin/<source-branch> --no-edit
```

## Step 6: Report Result

**If merge succeeded:**

```
Branch updated successfully.

Merged origin/<source-branch> into <branch-name>.
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
