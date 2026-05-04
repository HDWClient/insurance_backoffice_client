---
description: Generate a structured spec document for a feature or implementation step
allowed-tools: AskUserQuestion, Read, Bash, Write
argument-hint: "[feature or step name]"
---

# Spec Creator

Generate a complete, implementation-ready spec document for a feature or step, following the project's standard spec template.

---

## Step 1 — Understand the request

If the user passed an argument (`$ARGUMENTS`), use it as the feature/step name and skip directly to Step 2.

If no argument was given, use **AskUserQuestion** to ask:

> **What do you want to spec?**
> Describe the feature or implementation step in one or two sentences (e.g. "Add SQLite database layer", "Build user registration endpoint", "Implement JWT auth middleware").

---

## Step 2 — Explore the codebase

Before asking anything else, read the project to understand context. Run these in parallel:

- `find . -type f -name "*.py" -o -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" | grep -v node_modules | grep -v dist | grep -v .git | head -60` — get a feel for the file tree
- Read any entry-point files (`app.py`, `main.py`, `index.js`, `App.jsx`, etc.) that exist
- Read any existing spec or README files in the repo

Use this to inform: what already exists, what this step depends on, what file paths to reference.

---

## Step 3 — Gather requirements via questions

Use **AskUserQuestion** with **up to 4 questions at once** to fill in the spec. Tailor questions to what's still unknown after Step 2. Choose from:

- **Depends on**: "Does this step depend on any previous step or feature? If so, which?" *(skip if nothing else exists yet)*
- **Routes**: "What API routes or UI routes does this step add or change? List them, or say 'none'."
- **Schema / Data**: "What database tables or data models are involved? Describe columns and constraints, or say 'none'."
- **Functions / Components**: "What are the key functions, classes, or components to implement? Name them and briefly describe what each does."
- **Files to change**: "Which existing files need to be modified?"
- **Files to create**: "Which new files need to be created?"
- **Dependencies**: "Any new packages or libraries needed?"
- **Rules / Constraints**: "Any important rules — no ORMs, specific libraries to use, security requirements, etc.?"
- **Definition of Done**: "What checkboxes define this step as complete? List them."

Only ask what you don't already know from the codebase. Fewer targeted questions are better than many vague ones.

---

## Step 4 — Generate the spec document

Produce a complete spec document using the template below. Fill every section with real, specific content — no placeholders, no "TBD". If a section genuinely doesn't apply (e.g. no new routes), write "None" or "No changes" rather than omitting the section.

---

```markdown
# Spec Document

## 1. Overview

<2–4 sentences: what this step does, why it matters, what depends on it>

---

## 2. Depends on

<List the steps or features this builds on, or "Nothing — this is the first step.">

---

## 3. Routes

<Table or bullet list of every new or changed route.>
<If none: "- No new routes">

| Method | Path | Description |
| --- | --- | --- |
| POST | /auth/login | Authenticates user, returns JWT |

---

## 4. Database Schema

<One subsection per table. If no DB changes, write "No database changes.">

---

### A. table_name

| Column | Type | Constraints |
| --- | --- | --- |
| id | INTEGER | Primary key, autoincrement |
| ... | ... | ... |

---

## 5. Functions / Components to Implement

<One subsection per function or component. Describe inputs, outputs, and behaviour — enough for a developer to implement without asking questions.>

---

### A. `function_name()`

- What it does
- Parameters
- Return value
- Key behaviour / side effects

---

## 6. Changes to Existing Files

<List each file and exactly what changes are needed in it.>

- `path/to/file.py` → import X, call Y on startup, add Z handler
- `path/to/other.jsx` → add route for /foo, pass prop bar to Component

---

## 7. Files to Change

<Bulleted list of paths — mirrors section 6 but as a quick reference.>

- `file1.py`
- `file2.jsx`

---

## 8. Files to Create

<Bulleted list of new file paths to create, or "None".>

- `services/auth.py`
- `components/LoginForm/index.jsx`

---

## 9. Dependencies

<New packages to install, or "No new dependencies — use [list existing ones used].">

---

## 10. Fixed Values / Constants

<Any enums, fixed lists, magic strings, or config values the implementation must use exactly.>

<If none, omit this section.>

---

## 11. Rules for Implementation

<Hard constraints the developer must follow — query style, security rules, naming conventions, etc.>

- Rule 1
- Rule 2

---

## 12. Expected Behaviour

<Describe what correct behaviour looks like at runtime. Use present tense ("returns", "creates", "redirects").>

---

## 13. Error Handling Expectations

<What should happen for each foreseeable error case — invalid input, missing records, auth failure, DB constraint violations, etc.>

---

## 14. Definition of Done

- [ ] Checklist item 1
- [ ] Checklist item 2
- [ ] ...
```

---

## Step 5 — Derive the filename

Convert the feature/step name into a kebab-case filename:
- Lowercase, spaces → hyphens, strip special characters
- Example: "Add SQLite database layer" → `add-sqlite-database-layer.md`

The save path is always: `.claude/spec/<kebab-name>.md`

Run `mkdir -p .claude/spec` before writing to ensure the folder exists.

---

## Step 6 — Write the file

Use the **Write** tool to save the spec to `.claude/spec/<kebab-name>.md`. Then tell the user the exact path and a one-line summary of what was generated.
