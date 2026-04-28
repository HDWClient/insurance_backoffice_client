> Last Updated: 2026-04-21
> ⚠️ This file is updated as APIs are built. Check the date — if it's behind the backend feature docs, the backend docs are more current.

# API Reference

> Request/response formats for all endpoints. All requests require `withCredentials: true` and `X-ORG-ID` header (where applicable). All responses use the standard `ApiResponse<T>` envelope.

---

## Base URL

| Environment | Base URL |
|-------------|----------|
| Local dev | `http://localhost:8008` |
| Local → Staging (via proxy) | `` (empty — routes through Vite proxy) |
| Staging | `https://api.staging.mydomain.com` |
| Production | `` (empty — relative, same domain) |

---

## Auth

### POST `/auth/login/password`
No auth required. No `X-ORG-ID`.

**Request:**
```ts
{ email: string, password: string }
```

**Response `200`:**
```ts
ApiResponse<{
  userId: string
  email: string
  currentOrgId: string | null  // null for super admins
  orgs: { id: string, name: string, slug: string }[]
  // super admins: all active orgs; regular users: their single org
}>
```
Cookies set: `access_token`, `refresh_token` (HttpOnly, Secure, SameSite=Lax).

**Errors:** `INVALID_CREDENTIALS` (401), `ACCOUNT_DISABLED` (403), `EMAIL_NOT_VERIFIED` (403)

---

### POST `/auth/login/otp`
No auth required.

**Request:**
```ts
{ email: string, otp: string }
```
**Response:** Same as password login.

**Errors:** `INVALID_CREDENTIALS` (401), `OTP_EXPIRED` (401), `OTP_INVALIDATED` (401)

---

### POST `/auth/otp/send`
No auth required.

**Request:**
```ts
{ email: string, purpose: 'LOGIN' | 'FORGOT_PASSWORD' | 'INVITE' }
```
**Response `200`:** `ApiResponse<null>` — always 200, no enumeration.

---

### POST `/auth/otp/verify`
No auth required.

**Request:**
```ts
{ email: string, otp: string, purpose: 'FORGOT_PASSWORD' | 'INVITE' }
```
**Response `200`:**
```ts
ApiResponse<{ verifyToken: string }>  // short-lived, single-use, 15 min
```

---

### POST `/auth/forgot-password`
No auth required.

**Request:** `{ email: string }`
**Response:** Always `200 ApiResponse<null>` — no enumeration.

---

### POST `/auth/reset-password`
No auth required (uses verifyToken from body).

**Request:**
```ts
{ verifyToken: string, newPassword: string }
```
**Response `200`:** `ApiResponse<null>`. All sessions killed — user must log in again.

---

### POST `/auth/invite/accept`
No auth required. Verifies the invite OTP directly — no intermediate verifyToken step.

**Request:**
```ts
{ email: string, otp: string, password: string }
```
**Response `200`:** Sets login cookies. User is now active.
```ts
ApiResponse<{ userId: string, email: string, orgId: string | null }>
```

---

### POST `/auth/refresh`
No auth header. Refresh token cookie sent automatically by browser (scoped to this path).

**Response `200`:** `ApiResponse<null>`. New cookies set.
**Errors:** `REFRESH_TOKEN_EXPIRED` (401), `SESSION_INVALIDATED` (401)

---

### POST `/auth/logout`
Requires auth cookie.

**Response `200`:** `ApiResponse<null>`. Cookies cleared, session killed.

---

## ⚙️ More endpoints will be added here as APIs are built

The following modules are planned. Docs will be added when the backend implementation is ready:

| Module | Status |
|--------|--------|
| Users (`/users`) | Not built |
| Organizations (`/orgs`) | Not built |
| Roles & Permissions (`/roles`, `/permissions`) | Not built |
| Members (`/members`) | Blocked — open question |
| Dependents (`/members/{id}/dependents`) | Blocked — open question |
| Bulk Upload (`/bulk`) | Not built |
| Audit Logs (`/audit`) | Not built |
