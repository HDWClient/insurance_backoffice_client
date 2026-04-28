> Last Updated: 2026-04-21

# Frontend Integration Docs — Navigation

> These docs are written for the **frontend team and their AI assistants**. They describe how to integrate with the Kinko backoffice API — token handling, cookie behaviour, org context, environment configs, and API client setup.
>
> **Keep these in sync with the backend.** When an API changes, a new endpoint is added, or a response format changes — update the relevant doc here alongside the backend feature doc.

---

## How to Use These Docs

1. Start with [environments.md](environments.md) to understand your setup
2. Read [auth-and-cookies.md](auth-and-cookies.md) to understand how tokens and sessions work
3. Read [org-context.md](org-context.md) to understand how multi-org switching works
4. Read [api-client.md](api-client.md) to set up your HTTP client correctly
5. Reference [api-reference.md](api-reference.md) for endpoint request/response formats

---

## Document Map

| File | Purpose |
|------|---------|
| [environments.md](environments.md) | Local↔local, local↔staging, staging↔staging, prod setup, Swagger access |
| [auth-and-cookies.md](auth-and-cookies.md) | Login, cookie handling, token refresh interceptor, logout, OTP flows |
| [org-context.md](org-context.md) | How org is resolved, X-ORG-ID header, subdomain, org picker UX |
| [api-client.md](api-client.md) | Axios/fetch setup, interceptors, error handling, withCredentials |
| [api-reference.md](api-reference.md) | All endpoints with request/response formats — updated as APIs are built |

---

## Key Rules for the Frontend

- **Never store tokens in localStorage or sessionStorage** — cookies are set by the server, the browser handles them
- **Never read or send tokens manually** — just make requests normally, the browser attaches cookies
- **Always use `withCredentials: true`** (or `credentials: 'include'` in fetch) — required for cookies to be sent cross-origin
- **Always send `X-ORG-ID` header** when the active org is known — backend will fall back to subdomain but explicit is safer
- **Handle `401 TOKEN_EXPIRED` with a refresh interceptor** — do not redirect to login on every 401
- **Handle `401 SESSION_INVALIDATED`** by redirecting to login — token version mismatch means logged in elsewhere
- **Swagger is available on local and staging** — not on production

---

## Response Envelope

Every API response uses this wrapper:

```ts
interface ApiResponse<T> {
  success: boolean
  data: T | null
  message: string | null
  errorCode: string | null   // e.g. "TOKEN_EXPIRED", "MEMBER_NOT_FOUND"
}

interface PagedResponse<T> {
  success: boolean
  data: {
    content: T[]
    page: number
    size: number
    totalElements: number
    totalPages: number
  }
  message: string | null
  errorCode: string | null
}
```

Check `errorCode` for specific error handling — do not rely on HTTP status alone.
