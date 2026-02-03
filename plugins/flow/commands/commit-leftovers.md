---
description: Commit unstaged changes in logical separate commits
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*), Bash(git diff:*), Bash(git push:*), Bash(git branch:*), mcp__plugin_linear_linear__get_issue
---

# Commit Leftovers

Analyze unstaged changes and divide them into logical, separate commits.

## Context

- Current git status: !`git status`
- Staged changes: !`git diff --cached --stat`
- Unstaged changes: !`git diff --stat`
- Current branch: !`git branch --show-current`

## Your task

Commit any staged changes first, then organize unstaged changes into logical, separate commits.

### Step 1: Commit Staged Changes (if any)

If there are already staged changes:

1. Analyze what's staged and craft an appropriate commit message
2. Create the commit:
   ```bash
   git commit -m "<type>(<scope>): <description>"
   ```

If no staged changes, skip to Step 2.

### Step 2: Analyze Unstaged Changes

Look at the unstaged changes and group them logically by:

- **Feature/functionality**: Changes that belong to the same feature
- **File type**: Related config files, test files, source files
- **Component/module**: Changes within the same component or module
- **Purpose**: Bug fixes, refactors, style changes, etc.

### Step 3: Create Commits Iteratively

For each logical group:

1. Stage only the files belonging to that group:

   ```bash
   git add <file1> <file2> ...
   ```

2. Create a commit with a descriptive message following conventional commit format:

   ```bash
   git commit -m "<type>(<scope>): <description>"
   ```

3. Check remaining unstaged changes:

   ```bash
   git status
   ```

4. Repeat until no unstaged changes remain.

### Step 4: Push All Commits

After all commits are created, push to remote:

```bash
git push
```

### Step 5: Get Issue Link

Extract the issue ID from the branch name (e.g., `alex/art-60-description` → `ART-60`).

If an issue ID is found, use `get_issue` to fetch the issue URL for the output.

### Guidelines

- **Keep commits atomic**: Each commit should represent one logical change
- **Don't mix concerns**: Separate refactors from features from bug fixes
- **Use conventional commits**: `feat`, `fix`, `refactor`, `style`, `docs`, `chore`, `test`
- **Be specific**: Commit messages should clearly describe what changed

### Example Groupings

```
Group 1: feat(auth): add login validation
  - src/auth/validator.ts
  - src/auth/types.ts

Group 2: test(auth): add validator tests
  - src/auth/__tests__/validator.test.ts

Group 3: style: fix linting issues
  - src/utils/helpers.ts
  - src/components/Button.tsx

Group 4: chore: update dependencies
  - package.json
  - pnpm-lock.yaml
```

## Output

After each commit:

```
Committed: <short-hash> <commit-message>
  - <file1>
  - <file2>
```

After all commits and push:

```
Done! Created X commits:
  1. <hash> <message>
  2. <hash> <message>
  ...

Pushed to remote.
Issue: <issue-id>
Link: <issue-url>
```

If no issue found:

```
Done! Created X commits:
  1. <hash> <message>
  2. <hash> <message>
  ...

Pushed to remote.
(No Linear issue linked)
```
