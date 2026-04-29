---
description: Pre-commit review — finds bugs in staged changes, logs to BUGS.md, asks before fixing
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(git status:*), Bash(git diff:*), Bash(git diff --cached:*), Bash(git log:*), Bash(npm test:*), Bash(npm run lint:*), Bash(touch:*), Bash(mkdir:*)
argument-hint: ""
---

# Pre-commit Bug Check

Run before `git commit`. **Do NOT run `git add` or `git commit` yourself** — your job ends with a clean BUGS.md and a verdict.

## Step 1 — Inspect staged changes
- `git status --short`
- `git diff --cached` (primary review target)

If nothing is staged, tell the user "nothing staged — stage with `git add` first" and stop. Do **not** create the sentinel file in this case.

## Step 2 — Review the staged diff
For each hunk, look for, in priority order:

1. **Bugs** — logic errors, null/undefined access, off-by-one, async race conditions, unhandled promise rejections, broken state updates
2. **Security** — XSS, injection, hardcoded secrets/tokens, missing input validation, insecure HTTP
3. **React-specific** — missing/incorrect hook deps, missing `key` props, stale closures, unnecessary re-renders, side effects in render
4. **Quality** — dead code, unclear naming, duplicated logic, leftover console.log/debugger

Skip nits and pure style preferences. Focus on things that could break or bite later.

## Step 3 — Classify each finding
- **Critical**: will break production or leak data
- **High**: feature broken or major regression
- **Medium**: real edge case or non-blocking regression
- **Low**: code smell, would-be-nice

## Step 4 — Append all findings to BUGS.md
Read BUGS.md (create if missing). Insert a new dated section at the **top**:

```
## YYYY-MM-DD — pre-commit batch

### [Severity] Short title
- **File**: path/to/file.js:123
- **Issue**: what's wrong (1–2 lines)
- **Suggested fix**: one-line approach
- **Status**: Open
```

Log every finding — even ones you'll fix immediately. The file is the audit trail.

If there are zero findings, still add a one-line entry: `## YYYY-MM-DD — pre-commit batch: clean (no issues found)` so the file reflects every check.

## Step 5 — Ask before fixing
Use **AskUserQuestion** to present findings as a multi-select list. Each option = one finding (severity + one-line summary). Always include an explicit `"Fix nothing — commit as-is"` option.

Only fix the items the user selects. For each fix:
- Make the minimal change (no surrounding refactors)
- Re-read the file to confirm
- Update that entry's `**Status**` line in BUGS.md to `Fixed in this commit`

## Step 6 — Verify
- If a test command exists, run only the relevant scope (`npm test -- <changed-paths>` or similar)
- Check tests pass before clearing the gate

## Step 7 — Create the commit-gate sentinel
After the user's chosen fixes are applied (or they chose "fix nothing"), create the sentinel that unblocks the commit:

```
mkdir -p .claude && touch .claude/.precommit-check-ok
```

This sentinel is one-shot and expires in 30 minutes. The PreToolUse hook on `git commit` consumes it.

## Step 8 — Final report
End with a short summary:
- bugs found (by severity)
- bugs fixed in this run
- bugs left Open in BUGS.md
- test result
- "Ready to commit. Run `git add -u && git commit -m '...'` when ready."

**Never run `git commit` yourself.** The user commits.
