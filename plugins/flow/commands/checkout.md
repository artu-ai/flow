---
disable-model-invocation: true
description: Checkout a branch for a Linear issue
argument-hint: [issue-id] [--no-worktree]
allowed-tools: mcp__claude_ai_Linear__get_issue, mcp__claude_ai_Linear__save_issue, Bash(git worktree *), Bash(git push *), Bash(git -C *), Bash(git rev-parse *), Bash(git checkout *), Bash(basename *), Bash(cp *), Bash(test *), Bash(echo *), Bash(code *)
---

# Checkout Linear Issue Branch

Create a worktree and branch for a Linear issue, enabling parallel development.

## Arguments

- **Issue ID**: `$1` - The Linear issue ID or identifier (e.g., "ABC-123"). If not provided, infer from conversation context.
- **Mode**: `$2` - Pass `--no-worktree` to create a regular branch instead of a worktree. Useful when you don't need an isolated devcontainer.

## Step 1: Get the Issue ID

If `$1` is provided:

- Use it as the issue ID

If `$1` is empty or not provided:

- Look through the conversation for a Linear issue ID or identifier (format: `ABC-123` or a UUID)
- If no issue ID can be found, respond with:
  > **No issue ID found.**
  >
  > Please provide an issue ID: `/flow:checkout ABC-123`
  >
  > Or discuss a Linear issue first, then run the command again.

## Step 2: Get Issue Details

Use `get_issue` with the issue ID to retrieve:

- Issue title
- Issue identifier (e.g., "ABC-123")
- Git branch name

If the issue is not found, report the error and stop.

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

The worktree path will be: `<repo-parent>/<repo-name>-<issue-identifier>`

For example, if the repo is at `/Users/alex/Projects/my-app` and the issue is `ABC-123`, the worktree path is `/Users/alex/Projects/my-app-ABC-123`.

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
   git worktree add <worktree-path> -b <branch-name>
   ```

   Use the git branch name from the issue.

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
   git -C <worktree-path> push -u origin <branch-name>
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

Skip to **Step 4: Update Issue Status**.

---

### Step 3b: Branch-only checkout

Create and switch to the branch without a worktree:

```bash
git checkout -b <branch-name>
```

Push and set upstream:

```bash
git push -u origin <branch-name>
```

Continue to **Step 4: Update Issue Status**.

---

## Step 4: Update Issue Status

Use `update_issue` to set the issue status to "In Progress".

## Step 5: Output the Result

**If worktree mode (default):**

```
Worktree: <worktree-path>
Branch: <branch-name>
Issue: <issue-identifier> - <issue-title> (In Progress)

To start working, open a new terminal and run:
  cd <worktree-path>

Run /flow:commit when done to create draft PR.
```

**If `--no-worktree` mode:**

```
Branch: <branch-name>
Issue: <issue-identifier> - <issue-title> (In Progress)

Run /flow:commit when done to create draft PR.
```

If any step fails, explain the error and what was completed successfully.
