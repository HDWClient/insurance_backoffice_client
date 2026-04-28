> Last Updated: 2026-04-22

# Auth & Cookies

> How authentication works, how cookies are managed, and how to implement the token refresh interceptor.

---

## How Tokens Work — What the Frontend Does Not Do

- ❌ Do not store tokens in `localStorage` or `sessionStorage`
- ❌ Do not read the cookie value — `HttpOnly` means JS cannot access it anyway
- ❌ Do not manually attach `Authorization: Bearer` headers in production
- ✅ Just make normal API requests — the browser attaches cookies automatically
- ✅ Use `withCredentials: true` (axios) or `credentials: 'include'` (fetch) — required for cookies to be sent

---

## Cookie Behaviour by Environment

| Environment | Who sets cookie | `Secure` flag | How browser sends it |
|-------------|----------------|--------------|---------------------|
| Local dev (HTTP) | `localhost:8008` | ❌ omitted (`app.cookie-secure: false`) | Browser sends automatically — no HTTPS needed |
| Local → Staging | Via Vite proxy, appears as `localhost` | ❌ omitted | Same as local dev — proxy makes it transparent |
| Staging / Production | HTTPS domain | ✅ present | Browser only sends over HTTPS |

Both cookies use `SameSite=Lax` (not `Strict`). `Lax` allows the cookie to be sent when a user follows a link to the app from an external page (email, Slack, etc.) — `Strict` would silently drop the session on those navigations.

The frontend does nothing special for cookie transport. Configure `withCredentials` once in the API client and forget about it.

---

## Login Flow

```ts
const response = await apiClient.post('/auth/login/password', { email, password })
// Server sets HttpOnly cookies in the browser — you don't see or touch them
// Response body contains:
// { success: true, data: { userId, email, orgId: string | null } }
// orgId is null for super admins who span multiple orgs

// Store userId/orgId in app state — NOT the token
```

After login, the response body tells you who the user is and which orgs they can access. Use this to show the org picker or navigate to the default org.

**OTP Login (passwordless):**
```ts
// Step 1 — request OTP
await apiClient.post('/auth/otp/send', { email, purpose: 'LOGIN' })

// Step 2 — submit OTP
const response = await apiClient.post('/auth/login/otp', { email, otp })
// Same response as password login
```

---

## Org Context After Login

The login response returns:

```ts
interface LoginResponse {
  userId: string
  email: string
  currentOrgId: string | null  // null = super admin
  orgs: { id: string; name: string; slug: string }[]
}
```

- **Single-org user** (Org Admin, Regular Admin): `currentOrgId` is set, `orgs` has one entry — go straight to dashboard
- **Super admin**: `currentOrgId` is null, `orgs` has all active orgs — show org picker, then set `X-ORG-ID` header on subsequent requests

See [org-context.md](org-context.md) for org switching behaviour.

---

## Token Refresh Interceptor

The access token expires (15–60 min). When it does, the API returns `401` with `errorCode: "TOKEN_EXPIRED"`. The frontend must silently refresh and retry the original request.

**Critical:** Multiple concurrent requests may fail at the same time. You must queue them and resolve after a single refresh — do not fire multiple refresh calls.

```ts
// src/api/interceptors.ts

let isRefreshing = false
let refreshQueue: Array<(retry: boolean) => void> = []

function processQueue(success: boolean) {
  refreshQueue.forEach(resolve => resolve(success))
  refreshQueue = []
}

apiClient.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config
    const errorCode = error.response?.data?.errorCode

    // SESSION_INVALIDATED or REFRESH_TOKEN_EXPIRED → hard logout, no retry
    if (errorCode === 'SESSION_INVALIDATED' || errorCode === 'REFRESH_TOKEN_EXPIRED') {
      redirectToLogin()
      return Promise.reject(error)
    }

    // TOKEN_EXPIRED → attempt silent refresh
    if (errorCode === 'TOKEN_EXPIRED' && !originalRequest._retried) {
      originalRequest._retried = true

      if (isRefreshing) {
        // Queue this request — wait for the in-flight refresh to complete
        return new Promise((resolve, reject) => {
          refreshQueue.push((success) => {
            if (success) resolve(apiClient(originalRequest))
            else reject(error)
          })
        })
      }

      isRefreshing = true
      try {
        await apiClient.post('/auth/refresh')  // refresh_token cookie sent automatically
        processQueue(true)
        return apiClient(originalRequest)      // retry original request
      } catch {
        processQueue(false)
        redirectToLogin()
        return Promise.reject(error)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)
```

---

## Logout

```ts
await apiClient.post('/auth/logout')
// Server clears cookies (Max-Age=0) and increments token version
// Frontend: clear local state, redirect to login
clearAppState()
redirectToLogin()
```

Do not try to clear cookies from the frontend — you cannot (HttpOnly). The server clears them via `Set-Cookie` with `Max-Age=0`.

---

## Invite Accept Flow

When an admin invites a new user, they receive an email with an OTP:

```ts
// User arrives on invite accept page with their email
// Single step — verify OTP + set password in one call
const { data } = await apiClient.post('/auth/invite/accept', {
  email,
  otp,
  password
})
// User is now active and logged in — cookies are set, same as login
// data: { userId, email, orgId }
```

---

## Forgot Password Flow

```ts
// Step 1 — request OTP (always returns 200 — no enumeration)
await apiClient.post('/auth/forgot-password', { email })

// Step 2 — verify OTP
const { data } = await apiClient.post('/auth/otp/verify', {
  email,
  otp,
  purpose: 'FORGOT_PASSWORD'
})
const { verifyToken } = data  // short-lived, single-use

// Step 3 — reset password
await apiClient.post('/auth/reset-password', { verifyToken, newPassword })
// All existing sessions killed — user must log in again
```

---

## Error Codes for Auth

| errorCode | HTTP | What to do |
|-----------|------|-----------|
| `INVALID_CREDENTIALS` | 401 | Show "Invalid email or password" |
| `ACCOUNT_DISABLED` | 403 | Show "Account disabled — contact admin" |
| `EMAIL_NOT_VERIFIED` | 403 | Redirect to OTP verification |
| `TOKEN_EXPIRED` | 401 | Silent refresh (interceptor handles) |
| `REFRESH_TOKEN_EXPIRED` | 401 | Redirect to login |
| `SESSION_INVALIDATED` | 401 | Show "Session ended — you may have logged in elsewhere", redirect to login |
| `SESSION_DEVICE_MISMATCH` | 401 | Show "Session invalid", redirect to login |
| `OTP_EXPIRED` | 401 | Show "OTP expired — request a new one" |
| `OTP_INVALIDATED` | 401 | Show "Too many attempts — request a new OTP" |
| `RATE_LIMIT_EXCEEDED` | 429 | Show "Too many attempts — try again in a few minutes" |
