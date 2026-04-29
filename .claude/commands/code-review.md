# Code Review — Find, Log, Fix

Review existing code (not staged diffs) for bugs, security issues, and quality problems. Log findings to BUGS.md and fix the ones the user picks.

**Usage**: `/code-review [path]`
- With a path (file, directory, or glob): review that scope only.
- Without a path: ask the user which scope to review (whole project, a folder, a single file, or recently changed files).

**Do NOT run `git add` or `git commit`.** This command is review-only — fixes are written to disk but committing is the user's call.

## Step 1 — Establish scope
- If `$ARGUMENTS` is provided, treat it as the target path/glob and confirm it exists with `ls` or by reading.
- If not provided, ask the user what to review. Offer concrete options: whole `src/`, a specific feature folder, a single file, or files changed since `main` (`git diff --name-only main...HEAD`).
- Stop and ask if the scope looks larger than ~30 files — large reviews should be batched. Suggest narrowing.

## Step 2 — Read the code
- Use Read for individual files and Explore agent for multi-file scans.
- For each file, look for, in priority order:

1. **Bugs** — logic errors, null/undefined access, off-by-one, async race conditions, unhandled promise rejections, broken state updates, incorrect conditionals
2. **Security** — XSS, injection (SQL/command/template), hardcoded secrets/tokens/keys, missing input validation, insecure HTTP, unsafe deserialization, missing auth checks
3. **React-specific** (if React code) — missing/incorrect hook deps, missing `key` props, stale closures, side effects in render, direct state mutation, leaked subscriptions
4. **Quality** — dead code, unclear naming, duplicated logic, leftover console.log/debugger, TODO/FIXME without ticket, swallowed errors

Skip nits and pure style preferences. Focus on things that could break or bite later.

## Step 3 — Classify each finding
- **Critical**: will break production or leak data
- **High**: feature broken or major regression
- **Medium**: real edge case or non-blocking regression
- **Low**: code smell, would-be-nice

## Step 4 — Append all findings to BUGS.md
Read BUGS.md (create if missing). Insert a new dated section at the **top**:

```
## YYYY-MM-DD — code-review: <scope>

### [Severity] Short title
- **File**: path/to/file.ext:line
- **Issue**: what's wrong (1–2 lines)
- **Suggested fix**: one-line approach
- **Status**: Open
```

Log every finding — even ones you'll fix immediately. The file is the audit trail.

If zero findings, still add: `## YYYY-MM-DD — code-review: <scope>: clean (no issues found)`.

## Step 5 — Ask before fixing
Use **AskUserQuestion** to present findings as a multi-select list. Each option = one finding (severity + one-line summary). Always include an explicit `"Fix nothing — review only"` option.

Only fix the items the user selects. For each fix:
- Make the minimal change (no surrounding refactors)
- Re-read the file to confirm the edit landed correctly
- Update that entry's `**Status**` line in BUGS.md to `Fixed (<short note>)`

## Step 6 — Verify
- If a test command exists in `package.json` / project config, run only the relevant scope (e.g. `npm test -- <changed-paths>`).
- If type-checking is configured (`tsc --noEmit`, etc.), run it on the touched files.
- Report results — do not gate on a green run, but call out any failures clearly.

## Step 7 — Final report
End with a short summary:
- files reviewed
- bugs found (by severity)
- bugs fixed in this run
- bugs left Open in BUGS.md
- test/typecheck result
- next suggested step (e.g. "review a sibling folder", "run /precommit-check before committing")
