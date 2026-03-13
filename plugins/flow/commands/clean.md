---
disable-model-invocation: true
description: Cleans up all git branches marked as [gone] (branches that have been deleted on the remote but still exist locally), including removing associated worktrees.
allowed-tools: Bash(git branch *), Bash(git worktree *), Bash(git rev-parse *), Bash(rm *), Bash(basename *), Bash(REPO_ROOT=*), Bash(for *)
---

## Your Task

You need to execute the following bash commands to clean up stale local branches that have been deleted from the remote repository.

## Commands to Execute

1. **First, list branches to identify any with [gone] status**
   Execute this command:
   ```bash
   git branch -v
   ```

   Note: Branches with a '+' prefix have associated worktrees and must have their worktrees removed before deletion.

2. **Next, identify worktrees that need to be removed for [gone] branches**
   Execute this command:
   ```bash
   git worktree list
   ```

3. **Remove worktrees and delete [gone] branches (handles both regular and worktree branches)**
   Execute this command:
   ```bash
   # Process all [gone] branches, removing '+' prefix if present
   git branch -v | grep '\[gone\]' | sed 's/^[+* ]//' | awk '{print $1}' | while read branch; do
     echo "Processing branch: $branch"
     # Find and remove worktree if it exists
     worktree=$(git worktree list | grep "\\[$branch\\]" | awk '{print $1}')
     if [ ! -z "$worktree" ] && [ "$worktree" != "$(git rev-parse --show-toplevel)" ]; then
       echo "  Removing worktree: $worktree"
       git worktree remove --force "$worktree"
     fi
     # Delete the branch
     echo "  Deleting branch: $branch"
     git branch -D "$branch"
   done
   ```

4. **Clean up stale sibling worktree directories**

   Worktrees are created as sibling directories of the repo root (e.g., `../repo-name-ABC-123`). After removing worktrees from git, check for leftover sibling directories:

   ```bash
   REPO_ROOT=$(git rev-parse --show-toplevel)
   REPO_NAME=$(basename "$REPO_ROOT")
   # List sibling directories matching the worktree naming convention
   for dir in "${REPO_ROOT}/../${REPO_NAME}-"*/; do
     if [ -d "$dir" ]; then
       resolved=$(cd "$dir" && pwd)
       # Check if this directory is still a registered worktree
       if ! git worktree list | grep -q "^${resolved} "; then
         echo "Removing stale worktree directory: $resolved"
         rm -rf "$resolved"
       fi
     fi
   done
   ```

## Expected Behavior

After executing these commands, you will:

- See a list of all local branches with their status
- Identify and remove any worktrees associated with [gone] branches
- Delete all branches marked as [gone]
- Remove any stale sibling worktree directories (matching `<repo-name>-*` in the parent directory)
- Provide feedback on which worktrees, branches, and directories were removed

If no branches are marked as [gone] and no stale directories exist, report that no cleanup was needed.

