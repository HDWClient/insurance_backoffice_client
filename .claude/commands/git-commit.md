---
description: Full pipeline — code-review → precommit-check → commit → deploy
allowed-tools: Read, Edit, Write, Glob, Bash(git status:*), Bash(git diff:*), Bash(git diff --cached:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(npm run build:*), Bash(npm run lint:*), Bash(aws s3 sync:*), Bash(aws s3 cp:*), Bash(aws cloudfront create-invalidation:*), Bash(aws sts get-caller-identity:*), Bash(mkdir:*), Bash(touch:*)
argument-hint: ""
---

# Full Commit Pipeline

Runs four phases in order: **Code Review → Pre-commit Check → Git Commit → Deploy**.
Stop and report if any phase fails. Never skip a phase.

---

## PHASE 1 — Code Review (staged files only)

### 1.1 — Stage all changes and identify what's staged
First, stage everything:
```
git add .
```
Then run:
- `git status --short`
- `git diff --cached --name-only`

If still nothing is staged after `git add .`, tell the user "Nothing to commit — working tree is clean." and **stop**.

### 1.2 — Review the staged diff
Run `git diff --cached` and read the full output. For each changed file look for:

1. **Bugs** — logic errors, null/undefined access, async race conditions, broken state updates, off-by-one
2. **Security** — XSS, injection, hardcoded secrets/tokens, missing auth, insecure HTTP
3. **React-specific** — missing/wrong hook deps, missing `key` props, stale closures, side effects in render
4. **Quality** — dead code, console.log/debugger left in, swallowed errors, duplicated logic

Skip pure style nits.

### 1.3 — Classify each finding
- **Critical** — breaks production or leaks data
- **High** — feature broken or major regression
- **Medium** — real edge case, non-blocking
- **Low** — code smell

### 1.4 — Log to BUGS.md
Read BUGS.md (create if missing). Insert a new dated section at the **top**:

```
## YYYY-MM-DD — code-review (staged)

### [Severity] Short title
- **File**: path/to/file.jsx:line
- **Issue**: what's wrong
- **Suggested fix**: one-line fix
- **Status**: Open
```

If zero findings, add: `## YYYY-MM-DD — code-review (staged): clean`

### 1.5 — Ask the user which findings to fix
Use **AskUserQuestion** — present each finding as a selectable item plus a **"Fix nothing — continue"** option.
Apply only the selected fixes (minimal changes). Update each fixed item's **Status** to `Fixed`.

---

## PHASE 2 — Pre-commit Check

### 2.1 — Re-read the staged diff after any Phase 1 fixes
Run `git diff --cached` again (fixes from Phase 1 may not be staged yet — remind the user to `git add -u` if needed).

### 2.2 — Check for commit blockers
Look specifically for:
- Hardcoded credentials or API keys in the diff
- `console.log`, `debugger`, `.only` test modifiers left in
- Obvious broken imports or missing files referenced in the diff
- Any Critical/High findings still **Open** in BUGS.md

### 2.3 — Run the linter
```
npm run lint 2>&1 | grep "src/" | head -30
```
Report any **new** errors introduced by the staged changes. Ignore pre-existing errors listed in CLAUDE.md.

### 2.4 — Update BUGS.md with pre-commit findings
Append any new blockers found in this phase to the same dated section. Mark them as `Open`.

### 2.5 — Ask before fixing blockers
If blockers exist, use **AskUserQuestion** to present them. The user must choose to fix or accept each one before continuing.

### 2.6 — Create the commit-gate sentinel
```
mkdir -p .claude && touch .claude/.precommit-check-ok
```

---

## PHASE 3 — Git Commit

### 3.1 — Stage any fixes from Phases 1 & 2
```
git add .
```

### 3.2 — Read the final staged diff and recent log
- `git diff --cached`
- `git log --oneline -5`

### 3.3 — Generate 3–4 commit message options
Each must be:
- Single line ≤ 72 chars
- Imperative mood ("Add", "Fix", "Update" — not "Added")
- Specific to the actual changes

Format:
```
1. fix: clear org form on successful create only
   → Precise, conventional-commit style

2. fix(OrgTab): preserve input fields when API returns error
   → Scoped, explains the UX preserved

3. Guard form reset behind fulfilled check
   → Direct imperative, no prefix
```

### 3.4 — Ask the user to pick one
Use **AskUserQuestion** with the 3–4 options plus **"Write my own"**.

### 3.5 — Commit
```
git commit -m "$(cat <<'EOF'
<chosen message>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

Run `git status` after committing and confirm the commit hash. If commit fails, diagnose and report — **do not retry blindly**.

---

## PHASE 4 — Deploy

### 4.1 — Load credentials from .env.deploy
Read `.env.deploy`. Export as environment variables:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN`
- `AWS_REGION`
- `S3_BUCKET`
- `S3_FOLDER`
- `CLOUDFRONT_DISTRIBUTION_ID`

### 4.2 — Verify AWS credentials
```
aws sts get-caller-identity
```
If expired or missing, **stop** and tell the user:
> "AWS credentials in `.env.deploy` have expired. Update `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_SESSION_TOKEN` with fresh values, then run `/git-commit` again."

### 4.3 — Build
```
npm run build
```
If the build fails, show the full error and **stop**. The commit already happened — tell the user the commit succeeded but deploy failed and they should fix the build error then run `/deploy`.

### 4.4 — Sync to S3
Upload each file type with correct cache headers:
```
# index.html — no-cache so users always get the latest
aws s3 cp dist/index.html s3://<S3_BUCKET>/<S3_FOLDER>/index.html \
  --content-type "text/html" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --region <AWS_REGION>

# JS bundles — immutable long-cache (hash in filename)
aws s3 sync dist/assets/ s3://<S3_BUCKET>/<S3_FOLDER>/assets/ \
  --exclude "*.css" --exclude "*.png" --exclude "*.svg" \
  --content-type "application/javascript" \
  --cache-control "max-age=31536000, immutable" \
  --region <AWS_REGION>

# CSS bundles — immutable long-cache
aws s3 sync dist/assets/ s3://<S3_BUCKET>/<S3_FOLDER>/assets/ \
  --exclude "*.js" --exclude "*.png" --exclude "*.svg" \
  --content-type "text/css" \
  --cache-control "max-age=31536000, immutable" \
  --region <AWS_REGION>

# Images, SVGs, and other static files
aws s3 sync dist/ s3://<S3_BUCKET>/<S3_FOLDER>/ \
  --exclude "*.html" --exclude "assets/*.js" --exclude "assets/*.css" \
  --cache-control "max-age=31536000, immutable" \
  --region <AWS_REGION>
```

### 4.5 — Invalidate CloudFront
```
aws cloudfront create-invalidation \
  --distribution-id <CLOUDFRONT_DISTRIBUTION_ID> \
  --paths "/<S3_FOLDER>/*"
```

---

## Final Summary

Print a clear pipeline summary:

```
✓ Phase 1 — Code Review    : N findings, M fixed
✓ Phase 2 — Pre-commit     : clean / N blockers resolved
✓ Phase 3 — Committed      : <commit hash> "<commit message>"
✓ Phase 4 — Deployed       : s3://<bucket>/<folder>/ synced
✓ CloudFront invalidation  : <INVALIDATION_ID> (ready in ~1-2 min)
```

If any phase failed, mark it with ✗ and describe what happened.
