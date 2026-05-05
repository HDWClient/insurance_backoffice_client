# Frontend Changes — Bulk Upload + Consumer `/users` Surface

> **Last Updated:** 2026-05-05
> **Backend version:** Plan B + Draft/Dispatch/Cancel revision (2026-05-05)
> **Audience:** Frontend developers (or AI agents working on the frontend codebase)
> **Prerequisite:** [changes-cms-users-rename.md](changes-cms-users-rename.md) (Plan A) must already be applied

This is a complete spec of the bulk-upload + verification + consumer-user
surface in `kinko-backoffice-backend`. Precise enough to apply mechanically.

---

## What changed since 2026-04-30 (delta from previous integration)

If you already integrated the original Plan B spec, here is everything that
changed. Anything not listed below is unchanged.

### Lifecycle change: invites are no longer auto-sent on upload

Previously: `POST /bulk/upload` parsed the CSV and immediately dispatched
invitation emails to every staged row.

Now: rows land in a new **`DRAFT`** state after parse. **No emails go out until
the admin explicitly hits `POST /bulk/{id}/dispatch`.** This gives admins a
review window — they can edit rows, cancel rows, or cancel the whole job before
broadcasting invites.

The new flow:

```
POST /bulk/upload      → job COMPLETED, rows DRAFT  (no email yet)
PUT /bulk/.../rows/{rowId}  → edit DRAFT row (optional)
POST /bulk/.../rows/{rowId}/cancel → cancel single row (optional, any pre-promotion state)
POST /bulk/{id}/dispatch  → invites go out, DRAFT rows flip to STAGED
                              ↓
                          rest of flow unchanged: STAGED → OTP_SENT → PROMOTED
```

Or short-circuit:

```
POST /bulk/{id}/cancel  → bulk-cancel every non-PROMOTED row, job → CANCELLED
```

### New row statuses

Two new values in the `BulkUploadRowStatus` enum:

| Status | Meaning |
|---|---|
| `DRAFT` | Parsed and persisted; awaiting admin review/dispatch. **NEW default post-parse status** (was `STAGED`). |
| `CANCELLED` | Admin cancelled this row pre-promotion. Verify endpoints return `INVITE_CANCELLED`. |

`STAGED` now means **invite has been dispatched** (was: parsed + invited in one step).

### New job status

| Status | Meaning |
|---|---|
| `CANCELLED` | Admin called `POST /bulk/{id}/cancel`. All non-PROMOTED rows flipped to `CANCELLED`. |

### New endpoints

| Method | Path | Permission |
|---|---|---|
| `PUT` | `/bulk/{idOrJobNumber}/rows/{rowId}` | `BULK_UPLOAD` |
| `POST` | `/bulk/{idOrJobNumber}/rows/{rowId}/cancel` | `BULK_UPLOAD` |
| `POST` | `/bulk/{idOrJobNumber}/cancel` | `BULK_UPLOAD` |
| `POST` | `/bulk/{idOrJobNumber}/dispatch` | `BULK_UPLOAD` |

### New / updated query params

`GET /bulk/{idOrJobNumber}/rows` now accepts a `search` query param (exact mobile,
exact rowNumber, or substring on employeeId/pincode/city/state). Email and name
remain unsearchable at the API level due to non-deterministic encryption — show
the existing client-side filter UI restricted to those columns or surface the
search box for the supported columns.

### New error codes

| errorCode | Where | Meaning |
|---|---|---|
| `INVALID_ROW_STATE` | edit, cancel-row | Row not in a state that allows the operation (already exists from resend-invite) |
| `INVALID_JOB_STATE` | dispatch, cancel-job | Job not in a state that allows the operation |
| `DUPLICATE_MOBILE` | edit | Mobile change collides with another active row in the same org |
| `INVITE_CANCELLED` | /verify/* | Recipient is hitting an invite for a row that the admin cancelled |
| `INVITE_NOT_DISPATCHED` | /verify/* | Recipient somehow has a token for a DRAFT row (shouldn't happen in practice) |

### Required UI changes for the frontend

1. **Bulk upload detail page** — add a "Review draft rows → Send invites" CTA.
   The job's `status=COMPLETED` no longer means invites are out; check
   `rowStats.STAGED + rowStats.OTP_SENT + rowStats.PROMOTED + ... > 0` or just
   show the dispatch button while `rowStats.DRAFT > 0`.
2. **Per-row actions** — when row is `DRAFT`, show "Edit" + "Cancel". When
   `STAGED` or beyond (pre-PROMOTED), show "Cancel" + "Resend invite".
3. **Job-level cancel** — destructive button that prompts for confirmation and
   POSTs to `/bulk/{id}/cancel`.
4. **Search box** on the rows table backed by the new `?search=` param.
5. **Verification portal** — handle the new `INVITE_CANCELLED` and
   `INVITE_NOT_DISPATCHED` error codes alongside the existing
   `INVITE_SUPERSEDED` — show the message verbatim from the API response.

No schema changes to existing response shapes. Existing endpoints behave
identically — only the post-parse row status changes from `STAGED` to `DRAFT`,
and the auto-send-on-import effect is gone (controlled by the same
`bulk.invite.send-on-import` config flag, which now only applies when
`/dispatch` is called and is left at default `true`).

---

## TL;DR

Three new groups of endpoints land:

1. **`/bulk/*`** — admin-authenticated. Submit a CSV, list jobs, drill into a job's
   rows or parse-time errors, resend invite for a single row.
2. **`/verify/*`** — public, **no JWT**. Used by the imported consumer (the one
   who got the invite email). HMAC-signed token in body authenticates the call.
   Two endpoints: request OTP, confirm OTP.
3. **`/users/*`** — admin-authenticated, **consumer-app users** that this org has
   imported. Read + status-update only — no direct CRUD insert/delete.

Plus 4 new permission codes (`BULK_UPLOAD`, `BULK_READ`, `USER_READ`, `USER_UPDATE`)
and a verification portal URL contract you'll need to host.

---

## 1. Bulk-upload endpoints (admin)

All require auth (JWT cookie) + the `X-ORG-ID` header (or org-resolution via host
slug). Permissions in parentheses.

### POST `/bulk/upload`  (BULK_UPLOAD)

Submit a CSV file for async ingestion.

- **Content-Type:** `multipart/form-data` with field name `file`
- **File limits:** `.csv` extension (lowercase), `text/csv` or `application/vnd.ms-excel`
  content-type, ≤ 10 MB, must contain a header row, must look like CSV (printable
  ASCII/UTF-8 with at least one comma in the head).
- **Response:** `202 Accepted` immediately — async parse runs in the background.

**Required CSV header columns:** `email`, `mobile`, `name`
**Optional columns:** `dob` (ISO YYYY-MM-DD), `gender` (M/F/O), `pincode` (6 digits),
`city`, `state`, `pan_number`, `aadhaar_last4` (4 digits), `employee_id`. Unknown
columns are stored in the row's `extras` JSON.

**Per-row validation** (parse-time, never reaches staging table):
- `email` required + format check
- `mobile` required + Indian 10-digit format (e.g. `9876543210`, `+919876543210`)
- `name` required, non-empty after trim

**Response (202):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "jobNumber": 5,
    "status": "PENDING",
    "fileName": "members-q2.csv",
    "totalRows": null,
    "parsedRows": null,
    "invalidRows": null,
    "rowStats": null,
    "startedAt": null,
    "completedAt": null,
    "createdAt": "2026-04-30T12:18:31.134Z"
  }
}
```

`rowStats` is null in the upload-submit response and in list responses (light payload).
It's populated in `GET /bulk/{id}` — see below.

**Job lifecycle (poll `GET /bulk/{id}`):** `PENDING → PROCESSING → COMPLETED` (or `FAILED`).
After admin review, `POST /bulk/{id}/dispatch` flips DRAFT rows → STAGED + sends invites,
or `POST /bulk/{id}/cancel` moves the whole job to `CANCELLED`. A 4-row CSV completes
parse in <3s on the local stack. Recommended polling cadence: 1–2s during PROCESSING.

### GET `/bulk`  (BULK_READ)

Paginated list of jobs in the org.

- Query: `?status=&page=&size=` (sizes capped at 100). Sorted newest-first.
- Returns `PagedResponse<BulkUploadResponse>` (same shape as the upload response).

### GET `/bulk/{idOrJobNumber}`  (BULK_READ)

Single job. Accepts either:
- The UUID `id`
- `#NNN` for the per-org `jobNumber` — URL-encoded as `%23NNN`. Example: `GET /bulk/%235` for jobNumber 5.

Cross-org IDs return **404** (not 403 — avoids leaking existence).

**Response includes `rowStats`** — group-by-status count of `bulk_upload_rows` for
this job. Always all 8 keys present, zero for empty buckets:

```json
{
  "id": "uuid",
  "jobNumber": 5,
  "status": "COMPLETED",
  "fileName": "members-q2.csv",
  "totalRows": 4,
  "parsedRows": 1,
  "invalidRows": 0,
  "rowStats": {
    "DRAFT": 1,
    "STAGED": 0,
    "OTP_SENT": 0,
    "VERIFIED": 0,
    "PROMOTED": 0,
    "REJECTED": 3,
    "EXPIRED": 0,
    "INVITE_FAILED": 0,
    "SUPERSEDED": 0,
    "CANCELLED": 0
  },
  "startedAt": "...",
  "completedAt": "...",
  "createdAt": "..."
}
```

**What the count fields mean:**
- `parsedRows` = rows that ended up `DRAFT` (eligible for invitation + promotion once the admin dispatches)
- `invalidRows` = **only** CSV-format errors (rows missing required fields — they have no DB representation, only show in `GET /bulk/{id}/errors`)
- Duplicates / cannot-supersede-promoted live as `REJECTED` rows in `bulk_upload_rows` and are clickable via `GET /bulk/{id}/rows?status=REJECTED`. They count toward `rowStats.REJECTED`, NOT `invalidRows`.

### GET `/bulk/{idOrJobNumber}/rows`  (BULK_READ)

Paginated staged rows. **PII fields decrypted server-side** before returning.

- Query: `?status=&search=&page=&size=` where status is one of:
  `DRAFT | STAGED | OTP_SENT | VERIFIED | PROMOTED | REJECTED | EXPIRED | INVITE_FAILED | SUPERSEDED | CANCELLED`
- `search` (optional): exact mobile, exact rowNumber if numeric, or
  case-insensitive substring on `employeeId`, `pincode`, `city`, `state`. Email
  and name aren't searchable server-side (encryption at rest).

For `REJECTED` rows, the `rejectionReason` field carries a human-readable string
explaining why — frontend can show this verbatim or pattern-match the prefix to
group ("DUPLICATE: …", "CANNOT_SUPERSEDE_PROMOTED: …").

**Row response shape:**
```json
{
  "id": "uuid",
  "rowNumber": 2,
  "email": "alice@example.com",
  "mobile": "9876543210",
  "name": "Alice",
  "dob": "1990-01-15",
  "gender": "F",
  "pincode": "560001",
  "city": "Bengaluru",
  "state": "Karnataka",
  "panNumber": "ABCDE1234F",
  "aadhaarLast4": "1234",
  "employeeId": "EMP-001",
  "status": "STAGED",
  "rejectionReason": null,
  "inviteSentCount": 1,
  "inviteLastSentAt": "2026-04-30T12:18:34.5Z",
  "inviteLastError": null,
  "promotedUserId": null,
  "promotedUserProfileId": null,
  "promotedAt": null,
  "createdAt": "2026-04-30T12:18:31.5Z"
}
```

### GET `/bulk/{idOrJobNumber}/errors`  (BULK_READ)

Returns the raw `invalid_rows_json` string for the job — rows rejected at parse
time and never staged. Shape is a JSON array (returned as a string in `data`):

```json
[
  {"rowNumber": 4, "rawLine": "carol@example.com,not-a-mobile,Carol Wrong", "errors": ["mobile is not a valid 10-digit number"]},
  {"rowNumber": 5, "rawLine": ",9876543213,Dave NoEmail", "errors": ["email is required"]}
]
```

Returns `null` in `data` if no parse-time errors occurred.

### Re-upload semantics (dedup + corrections)

What happens when the same admin uploads the same (or near-same) CSV twice:

Email is no longer sent automatically on upload — admin must trigger
`POST /bulk/{id}/dispatch`. The "Email sent?" column below assumes admin
later dispatches.

| Scenario | Per-row outcome on the new upload | Email on dispatch? |
|---|---|---|
| New `(orgId, mobile)` not seen before | `DRAFT` | ✓ |
| Same `(orgId, mobile)` AND identical content fingerprint | `REJECTED` with reason `DUPLICATE: identical row already exists (job X, row Y, status Z)` | ✗ |
| Same `(orgId, mobile)` AND different fingerprint AND old row not yet `PROMOTED` | New row `DRAFT` + old row flips to `SUPERSEDED` (its OTP invalidated) | ✓ for new row only |
| Same `(orgId, mobile)` AND different fingerprint AND old row is `PROMOTED` | `REJECTED` with reason `CANNOT_SUPERSEDE_PROMOTED: …; use the /users update endpoints, not re-import` | ✗ |
| Same mobile twice in the SAME upload (within-CSV dup) | First instance follows above rules; subsequent instances `REJECTED` with reason `DUPLICATE: same mobile appears earlier in this CSV` | ✓ for first only |

**Identity key is `mobile`** (because `users.mobile` is `@unique` on the consumer
schema). Email being identical is not enough — different mobile is treated as a
different person.

**Content fingerprint** is SHA-256 over `mobile|email|name|dob|gender|pincode|city|state|pan_number|aadhaar_last4|employee_id` (unit-separator joined). Same fingerprint = byte-identical row → true duplicate; different fingerprint with same mobile = correction.

**For the recipient who clicks an OLD (now `SUPERSEDED`) verify link:** the call
to `POST /verify/otp/send` returns `400 INVITE_SUPERSEDED` with message *"This
invitation was replaced by a newer one — check your inbox for a more recent
email"*. Frontend should display this message verbatim — it tells the user to
look for a more recent email.

### PUT `/bulk/{idOrJobNumber}/rows/{rowId}`  (BULK_UPLOAD)

Edit a row before invites have been dispatched. Allowed only when the row's
status is `DRAFT`. All body fields are optional (null = leave unchanged):

```json
{
  "email": "alice@example.com",
  "mobile": "9876543210",
  "name": "Alice",
  "dob": "1990-01-15",
  "gender": "F",
  "pincode": "560001",
  "city": "Bengaluru",
  "state": "Karnataka",
  "panNumber": "ABCDE1234F",
  "aadhaarLast4": "1234",
  "employeeId": "EMP-001"
}
```

Validation: same per-field rules as the CSV (email format, 10-digit Indian mobile,
6-digit pincode, PAN format, 4-digit aadhaar4, etc.).

**Errors:**
- `400 INVALID_ROW_STATE` — row is not in DRAFT (re-upload + cancel old row instead)
- `400 DUPLICATE_MOBILE` — the new mobile collides with another active row in the same org
- `404 BULK_ROW_NOT_FOUND` — row not in this job/org

### POST `/bulk/{idOrJobNumber}/rows/{rowId}/cancel`  (BULK_UPLOAD)

Cancel a single row pre-promotion. No body. Allowed from any of `DRAFT`, `STAGED`,
`OTP_SENT`, `VERIFIED`, `INVITE_FAILED`, `EXPIRED`. Sets status to `CANCELLED`
and invalidates any outstanding OTP.

For already-`PROMOTED` rows: use `PUT /users/{id}/status` to suspend the consumer
profile instead — this endpoint returns 400 `INVALID_ROW_STATE`.

**Use case:** admin re-uploads a CSV with corrected data (which `SUPERSEDES` the
old row), then cancels the old row to ensure the recipient's old email link
returns `INVITE_CANCELLED` rather than letting them silently OTP into outdated data.

### POST `/bulk/{idOrJobNumber}/cancel`  (BULK_UPLOAD)

Cancel an entire job. No body. Flips every non-PROMOTED row in the job to
`CANCELLED` and marks the job `CANCELLED`. Idempotent-safe to surface as a
"Discard this upload" destructive action — frontend should confirm with a modal.

**Errors:**
- `400 INVALID_JOB_STATE` — job already CANCELLED, or in FAILED state

### POST `/bulk/{idOrJobNumber}/dispatch`  (BULK_UPLOAD)

Send invitation emails to every row currently in `DRAFT`. Flips successful sends
to `STAGED`, failed sends to `INVITE_FAILED` (with the SMTP error captured in
`inviteLastError` — operator can retry per-row via `/resend-invite`).

Idempotent — a second call only touches rows still in `DRAFT`. Returns the
refreshed job response (with updated `rowStats` reflecting the dispatch outcome).

**Errors:**
- `400 INVALID_JOB_STATE` — job not in `COMPLETED` state (e.g. still PROCESSING, or already CANCELLED)

### POST `/bulk/{idOrJobNumber}/rows/{rowId}/resend-invite`  (BULK_UPLOAD)

Resends the invitation email for one row. No body.

**Rate limits:**
- 60s cooldown since last send (`verify.otp.resend-cooldown-seconds`)
- Max 5 sends per row total (`bulk.invite.max-sends`)

**Rejected for:** terminal-state rows (`PROMOTED`, `REJECTED`, `EXPIRED`).

Errors → 400 with `errorCode` `OTP_RATE_LIMITED`, `OTP_LOCKED`, or `INVALID_ROW_STATE`.

---

## 2. Verification portal endpoints (public)

These are **NOT authenticated by JWT**. The HMAC-signed `token` in the request
body — issued by the backend, included in the invitation email's verify link
as `?token=<...>` — is the only credential.

### POST `/verify/otp/send`

User clicks "Send me a code" on your verification portal page → frontend POSTs
the token here.

**Request:**
```json
{ "token": "<token-from-email-link>" }
```

**Response (200):**
```json
{
  "success": true,
  "data": { "sent": true, "expiresInSeconds": 600 }
}
```

**Errors:** 400 + `errorCode`:
- `INVALID_TOKEN` — tampered or unknown
- `OTP_RATE_LIMITED` — within 60s of last send (message tells how long to wait)
- `OTP_LOCKED` — total send count exceeded
- `ALREADY_VERIFIED` — row already PROMOTED
- `ROW_REJECTED` — row in REJECTED state

### POST `/verify/otp/confirm`

User enters the 6-digit code → frontend POSTs token + OTP.

**Request:**
```json
{ "token": "<token>", "otp": "123456" }
```

**Response (200):**
```json
{
  "success": true,
  "data": { "verified": true, "alreadyEnrolled": false }
}
```

`alreadyEnrolled: true` means the consumer was already enrolled in this org (matched
on mobile) — the row is REJECTED with reason `already enrolled`. UI should show a
friendlier "you're already enrolled, nothing more to do" message.

**Errors:** 400 + `errorCode`:
- `INVALID_TOKEN`, `INVALID_OTP`, `OTP_EXPIRED`, `OTP_LOCKED`, `ALREADY_VERIFIED`

### Verification portal URL contract

The invitation email button links to:
```
${bulk.invite.portal-base-url}/verify?token=<url-encoded-token>
```

Default portal base URL is `http://localhost:3000`. The frontend portal needs to:
1. Read `?token` from the URL
2. Render a "Verify my email" page with a "Send me a code" button
3. On click → POST `/verify/otp/send` with the token
4. Show an OTP input form
5. On submit → POST `/verify/otp/confirm` with token + OTP
6. On success → show a confirmation screen ("you're enrolled" or "already enrolled")

**The `token` is opaque** — frontend treats it as a string. It's an HMAC-signed
reference to a `bulk_upload_rows.id`; tampering invalidates it.

---

## 3. Consumer-user `/users` endpoints (admin)

The `/users` namespace was freed by the Plan A rename (`/users` → `/cms-users`
for backoffice operators). It now means **consumer-app users this org has imported**
via bulk upload — backed by the consumer-team-owned `users` + `user_profiles` tables.

Backoffice can READ profile data and UPDATE the org-scoped `user_profiles.status`.
**No direct CRUD insert/delete is exposed** — onboarding goes through `/bulk/upload + /verify`.

### GET `/users`  (USER_READ)

Paginated list. Filters:
- `search` — case-insensitive partial match on **name**. (Email/mobile search will
  break when real encryption replaces the placeholder; documented limitation.)
- `status` — `active | suspended | inactive`
- `uploadId` — filter to users imported by a specific bulk-upload job UUID
- `page=&size=` standard pagination

**PII fields decrypted server-side.**

**Response item shape:**
```json
{
  "id": "user-profile-uuid",
  "userId": "users-table-uuid",
  "email": "alice@example.com",
  "mobile": "9876543210",
  "name": "Alice",
  "dob": "1990-01-15",
  "gender": "F",
  "pincode": "560001",
  "city": "Bengaluru",
  "state": "Karnataka",
  "panNumber": "ABCDE1234F",
  "aadhaarLast4": "1234",
  "source": "cms_import",
  "status": "active",
  "orgSlug": "kinko",
  "organizationId": "uuid",
  "registrationChannel": "cms_import",
  "createdAt": "...",
  "updatedAt": "..."
}
```

### GET `/users/{userProfileId}`  (USER_READ)

Single profile. Cross-org IDs → 404.

### GET `/users/stats`  (USER_READ)

```json
{
  "success": true,
  "data": {
    "active": 12,
    "suspended": 1,
    "inactive": 0,
    "unverified": 3,
    "total": 13
  }
}
```

- `active`/`suspended`/`inactive` come from `user_profiles.status`.
- `unverified` is a count of `bulk_upload_rows` not yet PROMOTED and not in a
  terminal-failure state (i.e. imports awaiting consumer-side OTP confirm).
- `total` sums **only the three real status buckets**, not `unverified`.

### PUT `/users/{userProfileId}/status`  (USER_UPDATE)

Body:
```json
{ "status": "active" | "suspended" | "inactive", "reason": "optional string up to 500 chars" }
```

- 200 with the updated profile
- No-op if status is the same as current (no audit row written)
- 400 on invalid status value
- Emits `STATUS_CHANGE` audit row in `cms_audit_logs` with old/new/reason

---

## 4. New permission codes

Added by `RbacSeeder` on the next backend boot. Granted to default roles via
`OrgDefaultRoleService`:
- `AdminFullAccess`: gets all 4
- `FullReadOnly`: gets the 2 `_READ`s
- `LimitedAdmin`: gets all 4 (excludes `ROLE_*` only)

| Code | Module | Action | Gates |
|---|---|---|---|
| `BULK_UPLOAD` | BULK | UPLOAD | `POST /bulk/upload`, `POST /bulk/.../resend-invite` |
| `BULK_READ` | BULK | READ | `GET /bulk`, `/bulk/{id}`, `/bulk/{id}/rows`, `/bulk/{id}/errors` |
| `USER_READ` | USER | READ | `GET /users`, `/users/{id}`, `/users/stats` |
| `USER_UPDATE` | USER | UPDATE | `PUT /users/{id}/status` |

**Note the namespace boundary:** `CMS_USER_*` (Plan A) gates backoffice-operator
CRUD; `USER_*` gates consumer-user read/update. Both are returned in the
`/me/permissions` response under their respective module groups.

`/me/permissions` for an `AdminFullAccess` org-admin now looks like:
```json
{
  "ROLE": ["ASSIGN", "MANAGE"],
  "AUDIT": ["READ"],
  "ORG": ["READ"],
  "MEMBER": ["CREATE", "DELETE", "READ", "UPDATE"],
  "DEPENDENT": ["CREATE", "DELETE", "READ", "UPDATE"],
  "BULK": ["READ", "UPLOAD"],
  "USER": ["READ", "UPDATE"],
  "CMS_USER": ["CREATE", "DELETE", "READ", "UPDATE"]
}
```

---

## 5. New error codes (for frontend error-handling)

In addition to standard ones (`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`):

| errorCode | Where | Meaning |
|---|---|---|
| `BULK_INVALID_FILE` | POST /bulk/upload | File rejected (extension, type, size, magic bytes, no header) |
| `BULK_JOB_NOT_FOUND` | GET /bulk/{id} | Job not in this org |
| `BULK_ROW_NOT_FOUND` | resend-invite, edit, cancel-row | Row not in this job/org |
| `INVALID_ROW_STATE` | resend-invite, edit, cancel-row | Row not in a valid state for the operation |
| `INVALID_JOB_STATE` | dispatch, cancel-job | Job not in a valid state for the operation |
| `DUPLICATE_MOBILE` | edit | Mobile change collides with another active row in the same org |
| `INVITE_CANCELLED` | /verify/* | Recipient hit a token for a row the admin cancelled |
| `INVITE_NOT_DISPATCHED` | /verify/* | Recipient has a token for a row still in DRAFT (shouldn't normally happen) |
| `INVALID_TOKEN` | /verify/* | HMAC mismatch, malformed, or unknown |
| `INVALID_OTP` | /verify/otp/confirm | Wrong code or no active code |
| `OTP_EXPIRED` | /verify/otp/confirm | Code expired (default 10 min) |
| `OTP_RATE_LIMITED` | resend-invite, /verify/otp/send | Within cooldown window (default 60s) |
| `OTP_LOCKED` | resend-invite, /verify/otp/send/confirm | Send count or attempt count exceeded |
| `ALREADY_VERIFIED` | /verify/* | Row already PROMOTED |
| `ROW_REJECTED` | /verify/otp/send | Row in REJECTED state |
| `INVITE_SUPERSEDED` | /verify/otp/send | A later upload replaced this row — check inbox for a newer email |
| `USER_NOT_FOUND` | /users/{id} | Profile not in this org |

---

## 6. Audit log changes

New `cms_audit_logs` action types you may see in `GET /audit`:

| action | entityType | When | actorId | new_value highlights |
|---|---|---|---|---|
| `BULK_UPLOAD_CREATED` | `BulkUpload` | Job submitted | uploading cms_user | `{id, jobNumber, fileName, fileSize, storageKey, uploadedByEmail}` |
| `BULK_UPLOAD_COMPLETED` | `BulkUpload` | Job finished parse | same | `{status, totalRows, parsedRows, invalidRows}` |
| `BULK_INVITES_DISPATCHED` | `BulkUpload` | POST /bulk/{id}/dispatch | the cms_user calling | `{jobId, jobNumber, status, dispatched, failed, totalDraftRows}` |
| `BULK_JOB_CANCELLED` | `BulkUpload` | POST /bulk/{id}/cancel | the cms_user calling | `{jobId, jobNumber, status, cancelledRows}` |
| `BULK_ROW_EDITED` | `BulkUploadRow` | PUT /bulk/.../rows/{rowId} | the cms_user calling | `{rowId, jobId, rowNumber, status}` |
| `BULK_ROW_CANCELLED` | `BulkUploadRow` | POST /bulk/.../rows/{rowId}/cancel | the cms_user calling | `{rowId, jobId, rowNumber, status}` |
| `STATUS_CHANGE` | `UserProfile` | PUT /users/{id}/status | the cms_user calling the API | `{status, reason}` + `diff: {status: [old, new]}` |

**Promotion is intentionally NOT audited per-row** — that would produce 10k audit
rows for a 10k CSV. The two BULK_* job-level rows give the auditable summary.

---

## 7. Mechanical migration steps for the frontend codebase

### Step 1: Add the new endpoints to your API client

Build typed client methods for all 11 new endpoints listed above. Easiest path:
re-run OpenAPI codegen against `${API}/api-docs` — they're all there with proper
request/response schemas including the multipart file upload schema.

### Step 2: Build the bulk upload UI

- File picker → POST /bulk/upload (multipart)
- Job list table (poll → status + counts)
- Job detail view (rows table with status filter, errors panel for parse-time rejects)
- "Resend invite" button per row, disabled for terminal states + during cooldown

### Step 3: Build the verification portal

- Separate route at `/verify` that reads `?token` from URL
- Two-step: "Send code" button → OTP input form
- Hit POST /verify/otp/send and POST /verify/otp/confirm respectively
- This portal is **publicly accessible** — no login required

### Step 4: Build the consumer-users management UI

- `/users` page with search + status filter + uploadId filter (link from bulk job detail page)
- Profile detail view
- Status dropdown (active/suspended/inactive) with reason text field
- Stats badges on the dashboard from `/users/stats`

### Step 5: Update permission strings

If you have client-side RBAC checks (e.g. to hide buttons), register the four new codes:
```
"BULK_UPLOAD"
"BULK_READ"
"USER_READ"
"USER_UPDATE"
```

### Step 6: Test

- Upload a CSV via the file picker → see the job appear, watch status flip to COMPLETED
- Click into the job → see the staged rows
- Click resend-invite → confirm the rate-limit error on the second click within 60s
- Open MailHog (or your dev SMTP catcher) → see the invite emails
- Click an invite link in MailHog → land on your `/verify` page with token in URL
- Run through OTP flow → consumer ends up in `/users` list

---

## 8. Operational notes

**Encryption:** The backend currently uses a placeholder `TodoEncryptionService` that
prefixes plaintext with `v0:`. Real AES encryption replaces this once consumer-app
team provides the key/algorithm. **No frontend impact** — PII is decrypted server-side
before responses leave the API.

**Dev SMTP:** Local stack runs MailHog at http://localhost:8025. All bulk-invite
and OTP emails land there. To disable email send entirely (for non-SMTP dev),
set `BULK_INVITE_SEND_ON_IMPORT=false` in the backend env.

**Storage:** The local stack runs MinIO at http://localhost:9000 (S3 API) and
http://localhost:9001 (web console, login `minioadmin`/`minioadmin`). Uploaded
CSVs land in the `bulk-uploads` bucket under `bulk-uploads/{orgId}/{jobId}/...`.

---

## 9. Source-of-truth pointers

If anything is unclear, the backend is the canonical source:

- Plan: `kinko-backoffice-backend/.docs/plans/planned/bulk-upload-and-users.md`
- Feature spec: `.docs/features/07-bulk-upload.md`
- Permissions catalog: `.docs/source-of-truth/permissions-catalog.md`
- Live OpenAPI: `${API}/api-docs` (JSON), `${API}/swagger-ui.html` (interactive)
- Backend controllers:
  - `bulkupload/BulkUploadController.java` (admin /bulk/*)
  - `bulkupload/verify/VerificationController.java` (public /verify/*)
  - `consumeruser/ConsumerUserController.java` (admin /users/*)

