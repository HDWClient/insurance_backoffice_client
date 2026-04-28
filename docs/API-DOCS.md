> Last Updated: 2026-04-22 (updated: cookie flags, permission count, port, added Org & Me endpoints)
> **Source of truth for frontend integration.** Reflects what is actually deployed, not the spec.

# Backoffice API — Frontend Integration Docs

## Contents
- [Base URL & Setup](#base-url--setup)
- [Response Envelope](#response-envelope)
- [Auth Endpoints](#auth-endpoints)
- [User Management Endpoints](#user-management-endpoints)
- [Role & Permission Endpoints](#role--permission-endpoints)
- [Organization Endpoints](#organization-endpoints)
- [Me Endpoints](#me-endpoints)
- [Error Codes Reference](#error-codes-reference)
- [Cookie Behaviour](#cookie-behaviour)
- [Testing Locally](#testing-locally)

---

## Base URL & Setup

| Environment | Base URL |
|-------------|----------|
| Local dev   | `http://localhost:8008` |

**Required on every request:**
```ts
// axios
axios.create({ baseURL: 'http://localhost:8008', withCredentials: true })

// fetch
fetch(url, { credentials: 'include' })
```

`withCredentials: true` / `credentials: 'include'` is mandatory — without it the browser won't send HttpOnly cookies.

---

## Response Envelope

Every response, success or error, uses this shape:

```ts
interface ApiResponse<T> {
  success: boolean
  data: T | null        // present on success
  message: string | null   // present on error
  errorCode: string | null // present on error
}
```

**Success:**
```json
{ "success": true, "data": { ... } }
```

**Error:**
```json
{ "success": false, "message": "Invalid credentials", "errorCode": "INVALID_CREDENTIALS" }
```

---

## Auth Endpoints

All auth endpoints are under `/auth/**` and require no `Authorization` header (cookies handle auth).

---

### POST `/auth/login/password`

Login with email + password. Sets `access_token` and `refresh_token` HttpOnly cookies.

**Request:**
```json
{
  "email": "priya.sharma@acmecorp.in",
  "password": "Acme@2024!"
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "userId": "c3f1a2b4-...",
    "email": "priya.sharma@acmecorp.in",
    "currentOrgId": "d7e2f3a1-...",
    "orgs": [
      { "id": "d7e2f3a1-...", "name": "Acme Corp", "slug": "acme" }
    ]
  }
}
```
> `currentOrgId` is `null` for super admins. `orgs` contains all active orgs for super admins, or just the user's single org for regular users. Use `orgs` to populate the org picker.

**Cookies set:**
```
Set-Cookie: access_token=<jwt>; HttpOnly; SameSite=Lax; Path=/; Max-Age=900
Set-Cookie: refresh_token=<token>; HttpOnly; SameSite=Lax; Path=/auth/refresh; Max-Age=604800
```

> In production (HTTPS), the `Secure` flag is also present. On local dev (plain HTTP) it is intentionally omitted via `app.cookie-secure: false` — otherwise browsers silently drop the cookie.

**Errors:**

| errorCode | HTTP | When |
|-----------|------|------|
| `INVALID_CREDENTIALS` | 401 | Wrong email or wrong password (same message — no enumeration) |
| `ACCOUNT_DISABLED` | 403 | User is `inactive` or `suspended` |
| `EMAIL_NOT_VERIFIED` | 403 | Account created but email OTP not yet verified |
| `VALIDATION_ERROR` | 400 | Missing or malformed fields |

---

### POST `/auth/otp/send`

Send a 6-digit OTP to an email address. Use before OTP login, forgot-password, or invite flows.

**Request:**
```json
{
  "email": "priya.sharma@acmecorp.in",
  "purpose": "LOGIN"
}
```

> `purpose` must be one of: `LOGIN` | `FORGOT_PASSWORD` | `INVITE`

**Response `200`:**
```json
{ "success": true }
```

**Errors:**

| errorCode | HTTP | When |
|-----------|------|------|
| `USER_NOT_FOUND` | 401 | Email not in system (invite-only platform — OK to surface this) |
| `VALIDATION_ERROR` | 400 | Missing fields |

---

### POST `/auth/login/otp`

Login using a 6-digit OTP (passwordless). Requires a prior `/auth/otp/send` with `purpose: "LOGIN"`.

**Request:**
```json
{
  "email": "priya.sharma@acmecorp.in",
  "otp": "482917"
}
```

**Response `200`:** Same as `/auth/login/password` — sets same cookies.

**Errors:**

| errorCode | HTTP | When |
|-----------|------|------|
| `INVALID_CREDENTIALS` | 401 | User not found |
| `OTP_NOT_FOUND` | 401 | No OTP was sent, or wrong purpose |
| `OTP_EXPIRED` | 401 | OTP is older than 10 minutes |
| `OTP_INVALIDATED` | 401 | 5 wrong attempts — OTP is dead, request a new one |
| `INVALID_OTP` | 401 | Wrong code (attempt counted) |
| `ACCOUNT_DISABLED` | 403 | User inactive/suspended |
| `EMAIL_NOT_VERIFIED` | 403 | Email not verified |

---

### POST `/auth/otp/verify`

Verify an OTP for **non-login** flows (forgot-password, invite). Returns a short-lived `verifyToken` in the response body (not a cookie — this one is safe to hold in memory for the next step).

**Request:**
```json
{
  "email": "priya.sharma@acmecorp.in",
  "otp": "482917",
  "purpose": "FORGOT_PASSWORD"
}
```

> `purpose` must be `FORGOT_PASSWORD` or `INVITE`

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "verifyToken": "eyJhbGciOiJIUzI1NiJ9..."
  }
}
```

> Token is valid for 15 minutes, single-use. Pass it directly to `/auth/reset-password`.

**Errors:** Same as `/auth/login/otp`

---

### POST `/auth/forgot-password`

Trigger a password reset OTP. **Always returns 200** — no enumeration (you don't know if the email exists).

**Request:**
```json
{
  "email": "priya.sharma@acmecorp.in"
}
```

**Response `200`:**
```json
{ "success": true }
```

No errors. Always 200.

---

### POST `/auth/reset-password`

Set a new password using the `verifyToken` from `/auth/otp/verify`. Kills all existing sessions.

**Request:**
```json
{
  "verifyToken": "eyJhbGciOiJIUzI1NiJ9...",
  "newPassword": "NewAcme@2025!"
}
```

> Password minimum: 8 characters.

**Response `200`:**
```json
{ "success": true }
```

All sessions are invalidated — user must log in again.

**Errors:**

| errorCode | HTTP | When |
|-----------|------|------|
| `INVALID_VERIFY_TOKEN` | 401 | Token expired, already used, or tampered |
| `VALIDATION_ERROR` | 400 | Password too short |

---

### POST `/auth/invite/accept`

Accept an admin invite. Verifies the invite OTP, sets a password, activates the account, and issues a session.

**Request:**
```json
{
  "email": "rahul.mehta@acmecorp.in",
  "otp": "391027",
  "password": "MyFirst@Pass1"
}
```

> OTP is sent to email when admin sends the invite (via `/users/invite`).

**Response `200`:** Sets cookies, same as login.
```json
{
  "success": true,
  "data": {
    "userId": "a1b2c3d4-...",
    "email": "rahul.mehta@acmecorp.in",
    "currentOrgId": "d7e2f3a1-...",
    "orgs": [{ "id": "d7e2f3a1-...", "name": "Acme Corp", "slug": "acme" }]
  }
}
```

**Errors:**

| errorCode | HTTP | When |
|-----------|------|------|
| `INVALID_CREDENTIALS` | 401 | Email not found |
| `OTP_NOT_FOUND` | 401 | No invite OTP exists for this email |
| `OTP_EXPIRED` | 401 | Invite OTP older than 48 hours |
| `OTP_INVALIDATED` | 401 | 5 wrong attempts |
| `INVALID_OTP` | 401 | Wrong OTP |
| `VALIDATION_ERROR` | 400 | Password too short |

---

### POST `/auth/refresh`

Silently rotate the refresh token and issue a new access token. Called automatically by the interceptor when `TOKEN_EXPIRED` is received.

No request body. The `refresh_token` cookie is sent automatically by the browser (it's scoped to `/auth/refresh`).

**Response `200`:** New cookies set.
```json
{
  "success": true,
  "data": {
    "userId": "c3f1a2b4-...",
    "email": "priya.sharma@acmecorp.in",
    "currentOrgId": "d7e2f3a1-...",
    "orgs": [{ "id": "d7e2f3a1-...", "name": "Acme Corp", "slug": "acme" }]
  }
}
```

**Errors:**

| errorCode | HTTP | When |
|-----------|------|------|
| `REFRESH_TOKEN_MISSING` | 401 | No refresh cookie present |
| `INVALID_REFRESH_TOKEN` | 401 | Token not found in DB |
| `REFRESH_TOKEN_REVOKED` | 401 | Token was already revoked (logout happened) |
| `REFRESH_TOKEN_EXPIRED` | 401 | Token older than 7 days — must re-login |
| `SESSION_DEVICE_MISMATCH` | 401 | Request from different browser/device than login |
| `ACCOUNT_DISABLED` | 403 | User suspended since last login |

---

### POST `/auth/logout`

Revoke the current session. Clears both cookies. Requires being logged in.

No request body.

**Response `200`:**
```json
{ "success": true }
```

Cookies cleared:
```
Set-Cookie: access_token=; Max-Age=0
Set-Cookie: refresh_token=; Max-Age=0
```

No errors. Always succeeds (even if cookies are missing).

---

## User Management Endpoints

All user endpoints require:
- A valid session cookie (`access_token`)
- `X-ORG-ID` header set to the active org UUID

---

### GET `/users`

List all CMS users in the current org. Paginated.

**Query params:**

| Param | Default | Notes |
|-------|---------|-------|
| `page` | `0` | 0-based page number |
| `size` | `20` | Max `100` |

**Headers:**
```
X-ORG-ID: 550e8400-e29b-41d4-a716-446655440000
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "c3f1a2b4-...",
        "email": "rahul.mehta@acmecorp.in",
        "fullName": "Rahul Mehta",
        "isSuperAdmin": false,
        "status": "active",
        "emailVerified": true,
        "organizationId": "550e8400-...",
        "orgSlug": "acme",
        "createdAt": "2026-04-22T10:00:00Z"
      }
    ],
    "page": 0,
    "size": 20,
    "totalItems": 1,
    "totalPages": 1,
    "hasNext": false
  }
}
```

**Errors:** `FORBIDDEN` (403) if missing `USER_READ` permission.

---

### GET `/users/{id}`

Fetch a single user by UUID.

**Response `200`:** Single user object (same shape as items above).

**Errors:**

| errorCode | HTTP | When |
|-----------|------|------|
| `NOT_FOUND` | 404 | User doesn't exist or belongs to a different org |
| `FORBIDDEN` | 403 | Missing `USER_READ` permission |

---

### POST `/users`

Create a new active user with a known password. Use `/users/invite` for the invite-OTP flow.

**Request:**
```json
{
  "email": "priya.sharma@acmecorp.in",
  "fullName": "Priya Sharma",
  "password": "Acme@2024!"
}
```

**Response `201`:** Newly created user object.

**Errors:**

| errorCode | HTTP | When |
|-----------|------|------|
| `DUPLICATE_EMAIL` | 409 | Email already registered |
| `VALIDATION_ERROR` | 400 | Missing fields or password < 8 chars |
| `FORBIDDEN` | 403 | Missing `USER_CREATE` permission |

---

### POST `/users/invite`

Invite a user to the org. Creates a `pending_verification` user and triggers the OTP invite email. The user completes signup via `POST /auth/invite/accept`.

If the email already exists as `inactive` in this org, the user is smart-revived back to `pending_verification` (no duplicate error).

**Request:**
```json
{
  "email": "newadmin@acmecorp.in",
  "fullName": "New Admin"
}
```

**Response `201`:** User object with `status: "pending_verification"`.

**Errors:**

| errorCode | HTTP | When |
|-----------|------|------|
| `DUPLICATE_EMAIL` | 409 | Email exists and is active/pending (not revivable) |
| `FORBIDDEN` | 403 | Missing `USER_CREATE` permission |

---

### PUT `/users/{id}`

Update a user's profile (currently `fullName` only).

**Request:**
```json
{
  "fullName": "Priya Sharma Kapoor"
}
```

**Response `200`:** Updated user object.

**Errors:** `NOT_FOUND` (404), `FORBIDDEN` (403 — missing `USER_UPDATE`).

---

### DELETE `/users/{id}`

Soft-delete a user (status → `inactive`). The account is retained; the user cannot log in.

Guards:
- Cannot delete yourself (`SELF_DELETE` 403)
- Cannot delete a super admin (`SUPER_ADMIN_DELETE` 403)

**Response `204`:** No body.

**Errors:**

| errorCode | HTTP | When |
|-----------|------|------|
| `SELF_DELETE` | 403 | Attempting to delete your own account |
| `SUPER_ADMIN_DELETE` | 403 | Target is a super admin |
| `NOT_FOUND` | 404 | User not in this org |
| `FORBIDDEN` | 403 | Missing `USER_DELETE` permission |

---

### POST `/users/{id}/revive`

Reactivate a soft-deleted user (status `inactive` → `active`).

**Response `200`:** Updated user object.

**Errors:**

| errorCode | HTTP | When |
|-----------|------|------|
| `NOT_INACTIVE` | 403 | User is not inactive |
| `NOT_FOUND` | 404 | User not in this org |
| `FORBIDDEN` | 403 | Missing `USER_UPDATE` permission |

---

### GET `/users/{userId}/roles`

Get all roles currently assigned to a user.

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "role-uuid",
      "name": "ORG_ADMIN",
      "organizationId": "org-uuid",
      "orgSlug": "acme",
      "systemRole": true,
      "permissions": [
        { "id": "perm-uuid", "code": "USER_READ", "module": "USER", "action": "READ" }
      ]
    }
  ]
}
```

---

### POST `/users/{userId}/roles`

Assign a role to a user.

**Request:**
```json
{ "roleId": "role-uuid" }
```

**Response `201`:** `{ "success": true }`

**Errors:**

| errorCode | HTTP | When |
|-----------|------|------|
| `SCOPE_MISMATCH` | 403 | Role belongs to a different org |
| `PRIVILEGE_ESCALATION` | 403 | Caller is trying to assign a role they don't hold |
| `DUPLICATE` | 409 | User already has this role |
| `FORBIDDEN` | 403 | Missing `ROLE_ASSIGN` permission |

---

### DELETE `/users/{userId}/roles/{roleId}`

Revoke a role from a user.

**Response `204`:** No body.

---

## Role & Permission Endpoints

### GET `/permissions`

List all system permission codes. Use `id` values when assigning permissions to roles.

**Response `200`:**
```json
{
  "success": true,
  "data": [
    { "id": "perm-uuid", "code": "USER_READ", "module": "USER", "action": "READ" },
    { "id": "perm-uuid", "code": "USER_CREATE", "module": "USER", "action": "CREATE" }
  ]
}
```

---

### GET `/roles`

List all roles (custom + system) in the current org.

**Response `200`:** Array of role objects (same shape as user-roles response).

---

### POST `/roles`

Create a custom role.

**Request:**
```json
{ "name": "Support Agent" }
```

**Response `201`:** New role object with empty permissions array.

**Errors:** `DUPLICATE` (409), `FORBIDDEN` (403).

---

### PUT `/roles/{id}`

Rename a custom role. System roles cannot be renamed (`SYSTEM_ROLE` 403).

**Request:** `{ "name": "Senior Support Agent" }`

**Response `200`:** Updated role object.

---

### DELETE `/roles/{id}`

Delete a custom role. Must have no active user assignments (`ROLE_HAS_ASSIGNMENTS` 403).

**Response `204`:** No body.

---

### POST `/roles/{id}/permissions`

Add a permission to a role.

**Request:** `{ "permissionId": "perm-uuid" }`

**Response `200`:** Updated role object with new permission included.

---

### DELETE `/roles/{id}/permissions/{permId}`

Remove a permission from a role.

**Response `200`:** Updated role object.

---

## Organization Endpoints

> `ORG_CREATE` and `ORG_DELETE` are **not** role-assignable permissions. All org-write operations carry an additional super-admin guard — having the permission code is not enough.

### GET `/orgs`

List organizations.

- **Super admin**: returns all orgs
- **Org-scoped user**: returns only their own org

**Headers:** `X-ORG-ID` optional for super admin, required for org users.

**Response `200`:** Array of org objects.

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Head Digital Works",
      "slug": "hdw",
      "isDefault": false,
      "status": "active",
      "createdAt": "2026-04-22T10:00:00Z",
      "updatedAt": "2026-04-22T10:00:00Z"
    }
  ]
}
```

**Errors:** `FORBIDDEN` (403) — missing `ORG_READ`.

---

### GET `/orgs/{id}`

Get a single org. Org-scoped users can only fetch their own org (returns 404 otherwise).

**Response `200`:** Single org object (same shape as above).

---

### POST `/orgs`

Create a new org. **Super admin only.** Auto-creates the 3 default system roles for the new org.

**Request:**
```json
{ "name": "Deltatech Gaming", "slug": "dtg" }
```

> `slug` must be lowercase alphanumeric + hyphens (`^[a-z0-9-]+$`), 2–50 chars. Immutable after creation.

**Response `201`:** New org object.

**Errors:**

| errorCode | HTTP | When |
|-----------|------|------|
| `SUPER_ADMIN_REQUIRED` | 403 | Caller is not a super admin |
| `DUPLICATE_SLUG` | 409 | Slug already taken |
| `VALIDATION_ERROR` | 400 | Invalid slug format or missing fields |

---

### PUT `/orgs/{id}`

Update an org's **name** only. Slug is immutable.

**Request:** `{ "name": "Deltatech Gaming Ltd" }`

**Response `200`:** Updated org object.

**Errors:** `NOT_FOUND` (404), `FORBIDDEN` (403 — missing `ORG_UPDATE`).

---

### POST `/orgs/{id}/suspend`

Suspend an org (sets status → `inactive`). Cannot suspend the default org.

> ⚠️ Schema note: `OrgStatus` enum only has `active`/`inactive` in Prisma — `suspended` is pending a kinko_db PR. Currently maps to `inactive`.

**Response `200`:** Updated org object.

**Errors:**

| errorCode | HTTP | When |
|-----------|------|------|
| `DEFAULT_ORG` | 403 | Cannot suspend the default org |
| `ORG_DELETED` | 403 | Org is already inactive |
| `FORBIDDEN` | 403 | Missing `ORG_UPDATE` permission |

---

### POST `/orgs/{id}/activate`

Reactivate a suspended org (sets status → `active`).

**Response `200`:** Updated org object.

---

### DELETE `/orgs/{id}`

Soft-delete an org (sets status → `inactive`). **Super admin only.** Cannot delete the default org.

**Response `204`:** No body.

**Errors:**

| errorCode | HTTP | When |
|-----------|------|------|
| `SUPER_ADMIN_REQUIRED` | 403 | Caller is not a super admin |
| `DEFAULT_ORG` | 403 | Cannot delete the default org |
| `NOT_FOUND` | 404 | Org not found |

---

## Me Endpoints

### GET `/me/permissions`

Returns the set of permission codes the calling user holds in the active org.

- **Super admin**: returns all 19 permission codes regardless of org
- **Regular user**: returns only the permissions they hold via their assigned roles in the org from `X-ORG-ID`

Use this to conditionally show/hide UI elements without waiting for a 403.

**Headers:** `X-ORG-ID` — required for non-super-admin users.

**Response `200`:**
```json
{
  "success": true,
  "data": ["USER_READ", "USER_CREATE", "ROLE_MANAGE", "ORG_READ", "..."]
}
```

> Call this once after login and cache the result in app state. Re-fetch after org switching or role changes.

---

## Local Dev Test Accounts

All accounts use password: **`Dev@12345`**

### Root admin (super admin — sees all orgs, no org scope needed)

| Email | Password | Notes |
|-------|----------|-------|
| `root@kinko.local` | `Admin@123` | Root super admin — set in `.env.local` |

### Kinko org (slug: `kinko`)

| Email | Role | Permissions |
|-------|------|-------------|
| `org-admin@kinko.local` | AdminFullAccess | All 19 permissions |
| `read-only@kinko.local` | FullReadOnly | Read-only across all modules |
| `limited@kinko.local` | LimitedAdmin | All except ROLE_MANAGE, ROLE_ASSIGN |

### Kinko B2C org (slug: `kinko-b2c`)

| Email | Role | Permissions |
|-------|------|-------------|
| `admin@b2c.local` | AdminFullAccess | All 19 permissions |

### Head Digital Works (slug: `hdw`)

| Email | Role | Permissions |
|-------|------|-------------|
| `admin-full@hdw.local` | AdminFullAccess | All 19 permissions |
| `read-only@hdw.local` | FullReadOnly | Read-only across all modules |
| `limited@hdw.local` | LimitedAdmin | All except ROLE_MANAGE, ROLE_ASSIGN |

### Deltatech Gaming (slug: `dtg`)

| Email | Role | Permissions |
|-------|------|-------------|
| `admin-full@dtg.local` | AdminFullAccess | All 19 permissions |
| `read-only@dtg.local` | FullReadOnly | Read-only across all modules |
| `limited@dtg.local` | LimitedAdmin | All except ROLE_MANAGE, ROLE_ASSIGN |

> These accounts are seeded by `DevDataSeeder` on startup (local only). They are re-created if deleted (idempotent on restart).

---

## Error Codes Reference

### Auth errors

| errorCode | HTTP | Frontend message |
|-----------|------|-----------------|
| `INVALID_CREDENTIALS` | 401 | "Invalid email or password" |
| `ACCOUNT_DISABLED` | 403 | "Account is disabled — contact your admin" |
| `EMAIL_NOT_VERIFIED` | 403 | Redirect to email verification flow |
| `OTP_NOT_FOUND` | 401 | "No OTP was sent — request a new one" |
| `OTP_EXPIRED` | 401 | "OTP has expired — request a new one" |
| `OTP_INVALIDATED` | 401 | "Too many wrong attempts — request a new OTP" |
| `INVALID_OTP` | 401 | "Incorrect OTP — X attempts remaining" |
| `INVALID_VERIFY_TOKEN` | 401 | "Link expired — restart the flow" |
| `USER_NOT_FOUND` | 401 | "Email not found" |

### Session errors (interceptor handles these)

| errorCode | HTTP | Action |
|-----------|------|--------|
| `TOKEN_EXPIRED` | 401 | Call `/auth/refresh`, retry original request |
| `REFRESH_TOKEN_EXPIRED` | 401 | Redirect to login |
| `REFRESH_TOKEN_MISSING` | 401 | Redirect to login |
| `REFRESH_TOKEN_REVOKED` | 401 | Redirect to login |
| `SESSION_INVALIDATED` | 401 | Show "Logged in elsewhere" message, redirect to login |
| `SESSION_DEVICE_MISMATCH` | 401 | Show "Session invalid", redirect to login |

### General errors

| errorCode | HTTP | Notes |
|-----------|------|-------|
| `VALIDATION_ERROR` | 400 | `message` field contains what failed |
| `NOT_FOUND` | 404 | Resource or endpoint not found |
| `UNAUTHORIZED` | 401 | No session / not logged in |
| `FORBIDDEN` | 403 | Logged in but missing permission |
| `INTERNAL_ERROR` | 500 | Unexpected — report to backend |

---

## Cookie Behaviour

| Cookie | Path | Max-Age | Accessible from JS? |
|--------|------|---------|---------------------|
| `access_token` | `/` | 15 min (900s) | No (HttpOnly) |
| `refresh_token` | `/auth/refresh` | 7 days (604800s) | No (HttpOnly) |

`refresh_token` is scoped to `/auth/refresh` only — the browser will not send it to any other endpoint. This limits exposure if any endpoint is compromised.

**Flags:** Both cookies are `HttpOnly; SameSite=Lax`. The `Secure` flag is added in production (HTTPS) and intentionally omitted in local dev (plain HTTP) via `app.cookie-secure: false` in `application-local.yml` — browsers silently drop `Secure` cookies on non-HTTPS connections.

You **cannot** read these cookies from JavaScript. You don't need to — the browser sends them automatically.

---

## Testing Locally

### Automated test suite

Runs all API scenarios (auth, permissions, roles, users, user-roles, org management, access-control), then cleans up every resource it created. Re-running is safe — a pre-run sweep removes anything left by a previous interrupted run.

```bash
# From kinko-backoffice-backend/
BASE_URL=http://localhost:8008 ROOT_PASS=<root-admin-password> bash scripts/test-api.sh
```

> `ROOT_PASS` is the **plaintext** root admin password (not the bcrypt hash). Super-admin org tests are skipped if omitted.

### Swagger UI
`http://localhost:8008/swagger-ui/index.html` — sections ordered by build-plan phase (Auth → Roles → Permissions → Users → User Roles → Organizations → Me).

> Swagger UI works for individual endpoint calls once logged in (the browser sends the HttpOnly cookie automatically). For chained flows (login → refresh → logout), use curl or Postman.

### curl — full login flow
```bash
# 1. Login
curl -X POST http://localhost:8008/auth/login/password \
  -H "Content-Type: application/json" \
  -d '{"email":"org-admin@kinko.local","password":"Dev@12345"}' \
  -c /tmp/cookies.txt

# 2. Call a protected endpoint (replace ORG_ID with id from login response)
curl http://localhost:8008/users \
  -H "X-ORG-ID: <org-id>" \
  -b /tmp/cookies.txt

# 3. Refresh tokens
curl -X POST http://localhost:8008/auth/refresh \
  -b /tmp/cookies.txt -c /tmp/cookies.txt

# 4. Logout
curl -X POST http://localhost:8008/auth/logout \
  -b /tmp/cookies.txt
```

### curl — OTP login flow
```bash
# 1. Send OTP
curl -X POST http://localhost:8008/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{"email":"org-admin@kinko.local","purpose":"LOGIN"}'

# 2. Get OTP from container logs (dev only — SMTP not configured)
docker logs kinko-backoffice-api 2>&1 | grep EMAIL-STUB | tail -1

# 3. Login with OTP
curl -X POST http://localhost:8008/auth/login/otp \
  -H "Content-Type: application/json" \
  -d '{"email":"org-admin@kinko.local","otp":"<from logs>"}' \
  -c /tmp/cookies.txt
```

### curl — forgot-password flow
```bash
# 1. Trigger OTP (always 200)
curl -X POST http://localhost:8008/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"org-admin@kinko.local"}'

# 2. Get OTP from logs
docker logs kinko-backoffice-api 2>&1 | grep EMAIL-STUB | tail -1

# 3. Verify OTP → get verifyToken
VERIFY_TOKEN=$(curl -s -X POST http://localhost:8008/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"email":"org-admin@kinko.local","otp":"<from logs>","purpose":"FORGOT_PASSWORD"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['verifyToken'])")

# 4. Reset password
curl -X POST http://localhost:8008/auth/reset-password \
  -H "Content-Type: application/json" \
  -d "{\"verifyToken\":\"$VERIFY_TOKEN\",\"newPassword\":\"NewPass@2025!\"}"
```
