---
disable-model-invocation: true
description: Commit unstaged changes in logical separate commits
argument-hint: [--no-verify]
allowed-tools: Bash(git add *), Bash(git status *), Bash(git commit *), Bash(git diff *), Bash(git push *), Bash(git branch *), Bash(pnpm *), Bash(grep *), mcp__claude_ai_Linear__get_issue
---

# Commit Leftovers

Analyze unstaged changes and divide them into logical, separate commits.

## Context

- Current git status: !`git status`
- Staged changes: !`git diff --cached --stat`
- Unstaged changes: !`git diff --stat`
- Current branch: !`git branch --show-current`
- pnpm available: !`pnpm --version`
- Has lint script: !`grep -c lint package.json`
- Has check-types script: !`grep -c check-types package.json`
- Has check-circular script: !`grep -c check-circular package.json`

## Your task

Commit any staged changes first, then organize unstaged changes into logical, separate commits.

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

### Step 5: Get Issue Link (Linear only)

Extract the issue ID from the branch name (e.g., `alex/art-60-description` → `ART-60`). The branch must match the Linear `ABC-123` pattern.

If an issue ID is found, use `get_issue` to fetch the issue URL for the output. If no Linear issue ID is found, skip this step.

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
