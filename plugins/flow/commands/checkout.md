---
disable-model-invocation: true
description: Checkout a branch for a Linear issue or plain branch name
argument-hint: [issue-id-or-branch-name] [--no-worktree]
allowed-tools: mcp__claude_ai_Linear__get_issue, mcp__claude_ai_Linear__save_issue, Bash(git worktree *), Bash(git push *), Bash(git -C *), Bash(git rev-parse *), Bash(git checkout *), Bash(basename *), Bash(cp *), Bash(test *), Bash(echo *), Bash(code *)
---

# Checkout Branch

Create a worktree and branch for a Linear issue or a plain branch name, enabling parallel development.

## Arguments

- **Identifier**: `$1` - Either a Linear issue ID (e.g., "ABC-123") or a plain branch name (e.g., "my-feature", "fix/login-bug"). If not provided, infer from conversation context.
- **Mode**: `$2` - Pass `--no-worktree` to create a regular branch instead of a worktree. Useful when you don't need an isolated devcontainer.

## Step 1: Determine Mode (Linear vs Plain Branch)

If `$1` is provided, check if it looks like a Linear issue ID:

- **Linear issue ID pattern**: Matches `ABC-123` format (1+ uppercase letters, a hyphen, 1+ digits) or is a UUID
- **Plain branch name**: Anything else (e.g., "my-feature", "fix/login-bug", "feature/add-auth")

**If `$1` matches a Linear issue ID pattern** → continue to **Step 2a: Linear Mode**

**If `$1` is a plain branch name** → skip to **Step 2b: Plain Branch Mode**

If `$1` is empty or not provided:

- Look through the conversation for a Linear issue ID or a branch name
- If nothing can be found, respond with:
  > **No identifier provided.**
  >
  > Usage:
  > - Linear issue: `/flow:checkout ABC-123`
  > - Plain branch: `/flow:checkout my-feature-name`

## Step 2a: Linear Mode - Get Issue Details

Use `get_issue` with the issue ID to retrieve:

- Issue title
- Issue identifier (e.g., "ABC-123")
- Git branch name

If the issue is not found, report the error and stop.

Set `$IS_LINEAR = true`, `$BRANCH_NAME` = git branch name from issue, `$DISPLAY_NAME` = issue identifier.

Continue to **Step 3: Check Mode**.

## Step 2b: Plain Branch Mode

Set `$IS_LINEAR = false`, `$BRANCH_NAME` = `$1`, `$DISPLAY_NAME` = `$1`.

Continue to **Step 3: Check Mode**.

## Step 3: Check Mode

If `$2` is `--no-worktree`, skip to **Step 3b: Branch-only checkout**.

Otherwise, continue to **Step 3a: Worktree checkout**.

---

### Step 3a: Worktree checkout

#### Determine Worktree Path

Get the repository root and name:

```bash
git rev-parse --show-toplevel
```

```bash
basename $(git rev-parse --show-toplevel)
```

The worktree path will be: `<repo-parent>/<repo-name>-<$DISPLAY_NAME>`

For example, if the repo is at `/Users/alex/Projects/my-app` and the identifier is `ABC-123`, the worktree path is `/Users/alex/Projects/my-app-ABC-123`. For a plain branch `my-feature`, it would be `/Users/alex/Projects/my-app-my-feature`.

#### Create Worktree and Branch

Check if the worktree already exists:

```bash
git worktree list
```

**If the worktree already exists** for this issue:

- Output the existing worktree path and skip to Step 6

**If the worktree does not exist:**

1. **Create worktree with new branch**:

   ```bash
   git worktree add <worktree-path> -b $BRANCH_NAME
   ```

2. **Rewrite the `.git` file** to use a relative path so git resolves correctly both on the host and inside devcontainers:

   ```bash
   echo "gitdir: ../<repo-name>/.git/worktrees/<worktree-dir-name>" > <worktree-path>/.git
   ```

   Where `<worktree-dir-name>` is `basename <worktree-path>` (e.g., `my-app-ABC-123`).

   > This is critical. The default `.git` file contains an absolute host path
   > that breaks inside containers. The relative path resolves correctly from
   > `/workspaces/my-app-ABC-123/` to `/workspaces/my-app/.git/worktrees/my-app-ABC-123/`.

3. **Push and set upstream** (from the new worktree):
   ```bash
   git -C <worktree-path> push -u origin $BRANCH_NAME
   ```

#### Copy Environment Files

If a `.env` file exists in the main worktree, copy it to the new worktree:

```bash
test -f <main-repo-path>/.env
```

If the file exists (exit code 0):

```bash
cp <main-repo-path>/.env <worktree-path>/.env
```

This ensures the new worktree has the same environment configuration.

#### Open Worktree in VS Code

Open the worktree as a new VS Code window:

```bash
code -n <worktree-path>
```

VS Code will detect `.devcontainer/` (if present) and prompt to reopen in a container, starting an isolated devcontainer for this issue.

Skip to **Step 4: Update Issue Status (Linear only)**.

---

### Step 3b: Branch-only checkout

Create and switch to the branch without a worktree:

```bash
git checkout -b $BRANCH_NAME
```

Push and set upstream:

```bash
git push -u origin $BRANCH_NAME
```

Continue to **Step 4: Update Issue Status (Linear only)**.

---

## Step 4: Update Issue Status (Linear only)

**If `$IS_LINEAR` is true:**

Use `update_issue` to set the issue status to "In Progress".

**If `$IS_LINEAR` is false:**

Skip this step entirely.

## Step 5: Output the Result

**If worktree mode + Linear:**

```
Worktree: <worktree-path>
Branch: $BRANCH_NAME
Issue: <issue-identifier> - <issue-title> (In Progress)

To start working, open a new terminal and run:
  cd <worktree-path>

Run /flow:commit when done to create draft PR.
```

**If worktree mode + plain branch:**

```
Worktree: <worktree-path>
Branch: $BRANCH_NAME

To start working, open a new terminal and run:
  cd <worktree-path>

Run /flow:commit when done to create draft PR.
```

**If `--no-worktree` mode + Linear:**

```
Branch: $BRANCH_NAME
Issue: <issue-identifier> - <issue-title> (In Progress)

Run /flow:commit when done to create draft PR.
```

**If `--no-worktree` mode + plain branch:**

```
Branch: $BRANCH_NAME

Run /flow:commit when done to create draft PR.
```

If any step fails, explain the error and what was completed successfully.
