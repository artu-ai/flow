---
name: pr-context
description: Fetch the current pull request's details, CI status, and review state. Use when you need to understand the PR status, check CI/build results, see review comments, understand what reviewers requested, or when the user mentions "the PR", "pull request", "checks", "CI", "build status", or "reviews".
allowed-tools: Bash(gh pr view:*), Bash(gh pr checks:*), Bash(git branch:*)
---

# PR Context

This skill retrieves the current pull request's details to provide context about the PR state.

## When to Use

- When you need to check CI/build status
- When the user asks about "the PR", "pull request", or "checks"
- When you need to see review comments or requested changes
- When checking if PR is ready to merge
- When the user asks "what's the PR status?" or "did CI pass?"

## Fetching PR Details

### Basic PR Information

Get PR details for current branch:

```bash
gh pr view --json title,body,state,isDraft,url,number,headRefName,baseRefName,mergeable,reviewDecision,additions,deletions,changedFiles
```

This returns:

- **title**: PR title
- **body**: PR description
- **state**: OPEN, CLOSED, or MERGED
- **isDraft**: Whether it's a draft PR
- **url**: PR URL
- **reviewDecision**: APPROVED, CHANGES_REQUESTED, REVIEW_REQUIRED, or null
- **mergeable**: Whether it can be merged
- **additions/deletions**: Lines changed
- **changedFiles**: Number of files changed

### CI/Check Status

Get status of all checks:

```bash
gh pr checks
```

This shows:

- Check name
- Status (pass, fail, pending)
- Duration
- Link to details

### Review Comments

Get review comments if needed:

```bash
gh pr view --json reviews --jq '.reviews[] | {author: .author.login, state: .state, body: .body}'
```

## Providing Context

After fetching, summarize based on what the user needs:

### For status overview:

```
PR #123: Implement user authentication
Status: Open (Draft)
Reviews: Awaiting review
CI: 3/4 checks passed, 1 pending
Mergeable: Yes
```

### For CI issues:

```
PR #123 - CI Status:

✓ lint (passed)
✓ typecheck (passed)
✗ test (failed) - https://github.com/...
◯ build (pending)

The test check failed. View details at the link above.
```

### For review feedback:

```
PR #123 - Reviews:

@reviewer1 - Changes Requested:
"Please add error handling for the edge case when..."

@reviewer2 - Approved:
"LGTM!"
```

## Example Full Output

```
PR #123: Implement user authentication
URL: https://github.com/org/repo/pull/123
Status: Open
Branch: feature/auth → main

Changes: +245 -32 across 8 files

Reviews: Changes Requested
- @alice requested changes: "Add tests for token expiry"

CI Status:
✓ lint
✓ typecheck
✓ test
✓ build

Mergeable: Blocked (needs approval)
```
