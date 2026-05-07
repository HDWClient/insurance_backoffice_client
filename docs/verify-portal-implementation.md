# Verification Portal — Frontend Implementation Spec

> **Last Updated:** 2026-05-07
> **Backend version:** Verify-Before-Promote (planned, see `.docs/plans/planned/verify-review-before-promote.md`)
> **Audience:** Frontend developers (or AI agents working on the frontend codebase)
> **Scope:** The PUBLIC `/verify` portal (main body) + an appendix at the bottom answering admin-side questions the frontend team raised
> **Status:** Backend endpoints described here are PLANNED. Do not ship frontend changes until backend deploy is confirmed.

This document is precise enough to apply mechanically. It supersedes §2 ("Verification portal endpoints") of [changes-bulk-upload-and-users.md](changes-bulk-upload-and-users.md) once the backend ships. Until then, treat that document as the live spec.

---

## What the verification portal is

It is a **publicly accessible web page** (no login, no JWT, no cookies required) at the URL the backend points invitation emails to:

```
${bulk.invite.portal-base-url}/verify?token=<url-encoded-opaque-token>
```

Default base URL on the local stack is `http://localhost:3000`. In production it'll be the marketing/portal domain that the backoffice product points to. The path segment `/verify` and the `token` query parameter are non-negotiable contract — the email link uses them verbatim.

The page is reached by an end-user (a consumer being enrolled into an insurance org by their HR / admin) who got an invitation email and clicked a button. They typically have **no prior relationship** with the product. The UX must therefore be simple, trust-building, and accessible on mobile.

---

## End-to-end user journey

```
   ┌─────────────────────────────────┐
   │ Email lands in invitee's inbox  │
   │ "Acme Insurance has invited you │
   │  to enrol — verify your email"  │
   │            [Verify]             │
   └────────────────┬────────────────┘
                    │ click
                    ▼
   ┌─────────────────────────────────┐
   │ Screen 1: Landing               │
   │ "Acme wants to enrol you.       │
   │  We'll send a 6-digit code to   │
   │  your email shared with us."    │
   │            [Send code]          │
   └────────────────┬────────────────┘
                    │ POST /verify/otp/send
                    ▼
   ┌─────────────────────────────────┐
   │ Screen 2: OTP input             │
   │ "Enter the 6-digit code we      │
   │  emailed you."                  │
   │      [_][_][_][_][_][_]         │
   │   [Verify]   [Resend in 60s]    │
   └────────────────┬────────────────┘
                    │ POST /verify/otp/confirm
                    ▼
   ┌─────────────────────────────────┐
   │ Screen 3: Review your details   │
   │ Name: Alice Smith               │
   │ DOB: 15 Jan 1990                │
   │ Mobile: 9876543210              │
   │ Email: alice@example.com        │
   │ PAN: ABCDE1234F                 │
   │ ...                             │
   │ [Yes, enrol me]   [Wrong info]  │
   └────────┬────────────────┬───────┘
            │                │
            │ POST           │ POST
            │ /verify/promote│ /verify/reject
            ▼                ▼
   ┌──────────────┐   ┌──────────────────────────┐
   │ Screen 4a:   │   │ Screen 4b:               │
   │ "You're      │   │ "Got it — we've notified │
   │  enrolled!"  │   │  Acme. They'll send you  │
   │              │   │  a corrected invite."    │
   └──────────────┘   └──────────────────────────┘
```

---

## Endpoints (full contract)

All endpoints accept `application/json`. None of them require auth headers. The `token` field carried in every request body is the credential.

### `POST /verify/otp/send`

**Purpose:** Generate and email a 6-digit OTP to the address attached to the row.

**Request:**
```json
{ "token": "<token-from-?token=-query-param>" }
```

**200 Response:**
```json
{
  "success": true,
  "data": {
    "sent": true,
    "expiresInSeconds": 600,
    "resendCooldownSeconds": 60
  }
}
```

**400 Errors** (`response.data` is null, `response.error.errorCode` is one of):
| errorCode | UI message (verbatim from API) | Recommended UX |
|---|---|---|
| `INVALID_TOKEN` | "This invitation link is invalid or has been tampered with." | Static error screen. Tell user to contact their admin. |
| `OTP_RATE_LIMITED` | "Please wait <N> seconds before requesting another code." | Show a countdown derived from message; disable "Send code" button. |
| `OTP_LOCKED` | "Too many code requests. Please contact your organization administrator." | Static error screen, no retry button. |
| `ALREADY_VERIFIED` | "This invitation has already been completed." | Static success-ish screen, no action needed. |
| `ROW_REJECTED` | "This invitation cannot be processed. Please contact your organization administrator." | Static error screen. |
| `INVITE_SUPERSEDED` | "This invitation was replaced by a newer one — check your inbox for a more recent email." | Static error screen, instruct user to look for a newer email. |
| `INVITE_CANCELLED` | "This invitation has been cancelled by the administrator. Please contact your organization for a new invite." | Static error screen. |
| `INVITE_NOT_DISPATCHED` | "This invitation has not been dispatched yet. Please wait for the administrator to send invites." | Static error screen. |

### `POST /verify/otp/confirm`

**Purpose:** Validate the OTP. On success, **flips the row to `VERIFIED` and returns the full unmasked details for review.** Does NOT promote yet.

**Request:**
```json
{ "token": "<same token>", "otp": "123456" }
```

**200 Response:**
```json
{
  "success": true,
  "data": {
    "verified": true,
    "verifiedAt": "2026-05-07T11:42:00Z",
    "reviewWindowSeconds": 900,
    "orgName": "Acme Insurance",
    "details": {
      "name": "Alice Smith",
      "email": "alice@example.com",
      "mobile": "9876543210",
      "dob": "1990-01-15",
      "gender": "F",
      "pincode": "560001",
      "city": "Bengaluru",
      "state": "Karnataka",
      "panNumber": "ABCDE1234F",
      "aadhaarLast4": "1234",
      "employeeId": "EMP-001"
    }
  }
}
```

Field notes for the review screen:
- **Render `details` AS-IS — no client-side masking.** OTP possession was the gate.
- `gender` is `M | F | O` — render as "Male" / "Female" / "Other".
- `dob` is ISO `YYYY-MM-DD` — render as "15 Jan 1990" or your locale equivalent. Never reformat into something the user has to mentally re-parse.
- `aadhaarLast4` is only the last 4 digits — render as "Aadhaar ending **** 1234" (no leading zeros stripping).
- Optional fields (`dob`, `gender`, `pincode`, `city`, `state`, `panNumber`, `aadhaarLast4`, `employeeId`) may be `null` or absent — render only those that have a value, in the order shown above.
- `reviewWindowSeconds` is the time the user has to click "Yes, enrol me" before the VERIFIED state expires. **Display a countdown** ("You have 14:32 to confirm"). When it hits zero, disable both buttons and show a "Session expired — please request a new code" message that takes them back to Screen 1.

**400 Errors:**
| errorCode | UI message | Recommended UX |
|---|---|---|
| `INVALID_TOKEN` | as above | Static error screen. |
| `INVALID_OTP` | "That code is incorrect. Please try again." | Stay on Screen 2; clear the input; show inline error. |
| `OTP_EXPIRED` | "That code has expired. Please request a new one." | Stay on Screen 2; show the "Resend code" button immediately. |
| `OTP_LOCKED` | "Too many incorrect attempts. Please contact your organization administrator." | Static error screen. |
| `ALREADY_VERIFIED` | "This invitation has already been completed." | Static success screen. |

### `POST /verify/promote`  *(NEW)*

**Purpose:** Final step. Creates the user/profile rows.

**Request:**
```json
{ "token": "<same token>" }
```

**200 Response:**
```json
{
  "success": true,
  "data": {
    "verified": true,
    "alreadyEnrolled": false
  }
}
```

`alreadyEnrolled: true` means the user was already enrolled in this org under the same mobile (matched in the atomic promotion transaction). Show a friendlier message: "You're already enrolled with Acme Insurance — no action needed." Do not treat it as an error.

**400 Errors:**
| errorCode | UI message | Recommended UX |
|---|---|---|
| `INVALID_TOKEN` | as above | Static error screen. |
| `NOT_VERIFIED` | "Please verify your email with the code first." | Send the user back to Screen 1. Should not happen via the normal flow. |
| `VERIFICATION_EXPIRED` | "Your verification has expired. Please request a new code and try again." | Send the user back to Screen 1. |
| `ALREADY_VERIFIED` | "You're already enrolled." | Static success screen. |
| `INVITE_CANCELLED` | as above | Static error screen. |

### `POST /verify/reject`  *(NEW)*

**Purpose:** Invitee tells the system the data is wrong; cancels the row so the admin can re-upload.

**Request:**
```json
{
  "token": "<same token>",
  "reason": "Wrong date of birth"
}
```

`reason` is optional, max 500 chars. Provide a free-text input on Screen 3 when the user clicks "Wrong info"; pre-fill with a small set of buttons ("Wrong name", "Wrong DOB", "Wrong mobile", "Wrong email", "Other") that fill the textarea. Final submit is the textarea content.

**200 Response:**
```json
{ "success": true, "data": { "rejected": true } }
```

**400 Errors:**
| errorCode | UI message | Recommended UX |
|---|---|---|
| `INVALID_TOKEN` | as above | Static error screen. |
| `INVALID_ROW_STATE` | "This invitation can no longer be rejected." | Static screen — likely the user already promoted in another tab. |
| `ALREADY_VERIFIED` | "You're already enrolled. To make changes, contact your organization administrator." | Static screen. |

---

## Page / route layout

### Route: `/verify`

**Single SPA route.** Reads `?token` from URL on mount. The token must be URL-decoded once (the email link URL-encoded it).

If the URL has no `?token` or it's empty after decode → render the static error screen straight away ("This link is invalid"). Do not call any API.

### State machine the page maintains

```
LANDING ─send code success─▶ OTP_INPUT ─confirm success─▶ REVIEWING ─promote success─▶ DONE_ENROLLED
   │                              │                          │                            
   │                              │                          ├─reject success───────────▶ DONE_REJECTED
   │                              │                          │                            
   │                              │                          └─review window expires────▶ EXPIRED → back to LANDING
   │                              │
   │                              └─OTP locked / etc────▶ TERMINAL_ERROR
   │
   └─token invalid────────────────────────────────────▶ TERMINAL_ERROR
```

Persist state ONLY in component memory. **Do not store the token in localStorage, sessionStorage, or cookies.** The token is short-lived and email-bound; persistence increases leak surface.

---

## Implementation notes (do exactly this)

### 1. Token handling

- Read once on mount: `const token = new URLSearchParams(window.location.search).get('token')`
- Treat as opaque string. Do not parse, decode, log, or include in error reports / analytics.
- Pass it verbatim in the body of every API call. Do not put it in headers or query params on the API calls — bodies only.

### 2. API client

- Use `fetch` or your existing axios instance. **Do not attach auth interceptors** — these endpoints reject any `Authorization` header. If your global axios instance attaches an `X-ORG-ID` header automatically, create a separate "anonymous" instance for `/verify/*` calls.
- Origin: same as the rest of the API (`process.env.NEXT_PUBLIC_API_BASE_URL` or equivalent). The verification portal is hosted on a different origin from the API; CORS is configured on the backend to allow the portal origin.

### 3. The OTP input

- Six separate single-character `<input>`s, each `inputmode="numeric"` `pattern="[0-9]"` `maxlength="1"`, with auto-advance on type and auto-back on backspace. Standard pattern.
- On paste, distribute digits across the inputs (handles users pasting `123 456` or `123-456`).
- Submit on the 6th digit (or with explicit "Verify" button — both fine, do whichever your design system prefers).

### 4. The review screen (Screen 3)

- Render details as a **vertical labelled list**, not a table. Mobile-first.
- Each field with a label on the left, value on the right (or stacked on narrow screens).
- Two CTAs at the bottom, primary "Yes, enrol me", secondary "Wrong info".
- Above the CTAs, a non-dismissable countdown: "You have 14:32 to confirm." The countdown derives from `verifiedAt + reviewWindowSeconds - now`. When ≤ 0, disable buttons and surface the "Session expired" message with a "Start over" button that resets to LANDING.

### 5. The reject screen (Screen 3 → reject path)

- Inline expansion or a small modal — do not navigate away. The user is already on Screen 3.
- Quick-pick chips: "Wrong name", "Wrong DOB", "Wrong mobile", "Wrong email", "Other"
- Optional text area below, max 500 chars (enforce client-side; backend also enforces).
- Submit button "Notify admin"; cancel button returns to the review.
- On success → Screen 4b. On error → inline error, stay on the modal/expansion.

### 6. Resend OTP cooldown

- After `POST /verify/otp/send` returns, start a countdown of `resendCooldownSeconds` (60s by default).
- Disable the "Resend code" button until 0.
- Backend will return `OTP_RATE_LIMITED` if you call it earlier — show the inline error if that happens (network race or the user landed mid-cooldown).

### 7. Error handling baseline

- All non-200 responses come with an `error: { errorCode, message }` envelope.
- When an `errorCode` we don't recognize is returned, fall back to showing `message` verbatim. This is forward-compatible — the backend may add new codes.
- Never display a generic "Something went wrong" — these are first-impression user flows; specific messages matter.

### 8. Accessibility

- All buttons must be keyboard-reachable in tab order. The OTP inputs in particular trip people up — make sure tabbing skips through them only when empty, and that arrow keys move between them.
- Respect `prefers-reduced-motion` on any countdown animation.
- The "wrong info" reason chips need real `aria-pressed` state.

### 9. No third-party tracking on this route

- The page is reached by people who have not yet consented to anything. Disable global analytics, session-replay tools, and any third-party SDKs on `/verify/*` routes. Only ship our own first-party error logging if you have it (and even then, scrub `token`, the `details.*` PII, and the OTP from any payload).

### 10. Tests

- Component test for each screen with a stubbed API client.
- Integration test that walks the full happy path against a real backend (use the dev stack at `http://localhost:8008` for the API + MailHog at `http://localhost:8025` to read the OTP).
- Specific test cases:
  - Token absent → terminal error, no API calls
  - Token invalid → terminal error after first call
  - OTP wrong twice, right third time → success, lands on review screen with the details rendered
  - Click "Yes, enrol me" → 4a screen
  - Click "Wrong info" + reason → reject API → 4b screen
  - Let the review countdown expire → buttons disable → "Start over" returns to landing
  - Cooldown: rapid double-click of "Send code" → second call shows the rate-limit message, not a generic error

---

## TypeScript types (drop-in)

```ts
// Public verify endpoints
export interface VerifySendOtpRequest { token: string; }
export interface VerifySendOtpResponse {
  sent: true;
  expiresInSeconds: number;
  resendCooldownSeconds: number;
}

export interface VerifyConfirmOtpRequest { token: string; otp: string; }
export interface VerifyConfirmOtpResponse {
  verified: true;
  verifiedAt: string;          // ISO 8601
  reviewWindowSeconds: number;
  orgName: string;
  details: VerifyDetails;
}

export interface VerifyDetails {
  name: string;
  email: string;
  mobile: string;              // 10-digit
  dob?: string | null;         // ISO YYYY-MM-DD
  gender?: 'M' | 'F' | 'O' | null;
  pincode?: string | null;     // 6-digit
  city?: string | null;
  state?: string | null;
  panNumber?: string | null;
  aadhaarLast4?: string | null;
  employeeId?: string | null;
}

export interface VerifyPromoteRequest { token: string; }
export interface VerifyPromoteResponse { verified: true; alreadyEnrolled: boolean; }

export interface VerifyRejectRequest { token: string; reason?: string; }
export interface VerifyRejectResponse { rejected: true; }

// Standard envelope
export interface ApiError { errorCode: string; message: string; }
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error?: ApiError;
}
```

---

## Source-of-truth pointers

- Backend plan: `kinko-backoffice-backend/.docs/plans/planned/verify-review-before-promote.md`
- Backend feature spec: `kinko-backoffice-backend/.docs/features/07-bulk-upload.md`
- Backend controllers (when shipped):
  - `bulkupload/verify/VerificationController.java` — `/verify/*` endpoints
  - `bulkupload/verify/VerificationService.java` — confirm/promote/reject logic
  - `bulkupload/verify/PromotionService.java` — atomic users + user_profiles insert
- Live OpenAPI: `${API}/api-docs` (JSON), `${API}/swagger-ui.html` (interactive)

If any of the field names, error codes, or response shapes here disagree with what the live OpenAPI says **after backend deploy**, the live OpenAPI wins — file an issue against this doc.

---

## Appendix — Admin-side questions from the frontend team

Everything above is the public `/verify` portal. These questions are about the **authenticated backoffice admin UI** that operates the bulk upload — answered here for convenience because the frontend team raised them in the same conversation. Endpoints below all require JWT cookie + `X-ORG-ID` header + the relevant RBAC permission, same as the rest of the backoffice API.

### 1. "A bulk-upload job should show a human-readable status (Draft / Pending Verification / etc.)"

**Yes.** `GET /bulk/{idOrJobNumber}` and `GET /bulk` will return a new server-derived `phase` field on every job response, alongside the existing raw `status` and `rowStats`:

```ts
export type BulkUploadPhase =
  | 'UPLOADING'              // parse in progress
  | 'DRAFT'                  // parsed; awaiting admin to dispatch invites
  | 'PENDING_VERIFICATION'   // invites dispatched; awaiting recipients
  | 'COMPLETED'              // all rows in terminal states
  | 'CANCELLED'              // admin cancelled the whole job
  | 'FAILED';                // parse error
```

| `phase` | Derivation (server-side, do not re-derive on client) | Admin UI label suggestion |
|---|---|---|
| `UPLOADING` | `status ∈ {PENDING, PROCESSING}` | "Uploading…" |
| `DRAFT` | `status == COMPLETED` AND `rowStats.DRAFT > 0` AND `rowStats.STAGED + OTP_SENT + VERIFIED + PROMOTED == 0` | "Draft — review before sending invites" |
| `PENDING_VERIFICATION` | `rowStats.STAGED + OTP_SENT + VERIFIED > 0` | "Pending verification" |
| `COMPLETED` | All non-rejected rows in terminal states | "Completed" |
| `CANCELLED` | `status == CANCELLED` | "Cancelled" |
| `FAILED` | `status == FAILED` | "Failed" |

**Frontend instructions:** read `phase` directly off the job response and render the label. Do NOT compute it from `rowStats` on the client — the backend is the single source of truth so labels are consistent across UIs and won't drift if buckets change.

### 2. "Search a row by email / employee code / name"

`GET /bulk/{idOrJobNumber}/rows?search=<term>` will support **case-insensitive substring match** on:

| Field | Match type | Notes |
|---|---|---|
| `email` | substring, case-insensitive | NEW |
| `name` | substring, case-insensitive | NEW |
| `employeeId` | substring, case-insensitive | already supported |
| `mobile` | exact 10-digit match | already supported |
| `rowNumber` | exact integer match | already supported |
| `pincode`, `city`, `state` | substring, case-insensitive | already supported |

**Frontend instructions:** wire one search input to `?search=<term>` — the backend tries all the fields above. No need for a "search by" dropdown unless your UX wants one. Hit the same endpoint as today; no new path.

> **Heads-up for the frontend team:** email + name search is being enabled while encryption is in placeholder mode. When the consumer-app team rolls out real (non-deterministic) encryption, this search will need to switch to blind-index columns. **The endpoint URL and query param won't change** — only the matching behavior may temporarily regress for email/name. We'll flag this in the changelog when it happens.

### 3. "Cancel a bulk upload while it's in DRAFT"

**Already shipped.** `POST /bulk/{idOrJobNumber}/cancel` works while `phase == DRAFT` — it flips every non-PROMOTED row to `CANCELLED` and the job to `CANCELLED`. Idempotent; only errors with `INVALID_JOB_STATE` if the job is already CANCELLED or FAILED.

**Frontend instructions:**
- On the job detail page, show a destructive **"Discard upload"** button whenever `phase ∈ {DRAFT, PENDING_VERIFICATION}` (we let admins kill an in-flight invite campaign too — recipients with un-confirmed tokens get `INVITE_CANCELLED` from the verify portal).
- Confirm with a modal (use the row count from `rowStats.DRAFT + STAGED + OTP_SENT + VERIFIED` so the modal can say "This will cancel 47 pending invitations").
- POST to `/bulk/{id}/cancel` with no body; refresh the job + rows query on success.

### 4. "Cancel a single row"

**Already shipped.** `POST /bulk/{idOrJobNumber}/rows/{rowId}/cancel` cancels one row, invalidates any outstanding OTP, and (for STAGED+ rows) ensures the recipient's email link returns `INVITE_CANCELLED` if they click it later.

Allowed row states: `DRAFT | STAGED | OTP_SENT | VERIFIED | INVITE_FAILED | EXPIRED`. Promoted rows error with `INVALID_ROW_STATE` — for those use `PUT /users/{userProfileId}/status` to suspend the consumer profile instead.

**Frontend instructions:**
- Per-row action menu shows "Cancel" whenever the row is in one of the allowed states above.
- For `DRAFT` rows, show "Edit" alongside "Cancel" (`PUT /bulk/{id}/rows/{rowId}` — see [changes-bulk-upload-and-users.md §1](changes-bulk-upload-and-users.md)).
- For `STAGED` and beyond pre-PROMOTED, show "Cancel" + "Resend invite".
- For `PROMOTED` rows, the row-level cancel is hidden; redirect the operator to the consumer profile in `/users/{userProfileId}` for the suspend action instead.
- POST to `/bulk/{id}/rows/{rowId}/cancel` with no body. Refresh the rows query and the parent job (`rowStats` will shift toward `CANCELLED`).

### Admin UI: where these surface

```
/admin/bulk                  ← list of jobs with `phase` badge
  /admin/bulk/{id}            ← job detail with rowStats, dispatch CTA, "Discard upload" CTA
    rows table              ← `?search=` input + per-row action menu (Edit/Cancel/Resend)
```

None of these admin endpoints touch the public verify portal — they're listed here only because the frontend team asked.
