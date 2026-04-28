> Last Updated: 2026-04-22

# Environments

> How the frontend connects to the backend across all environments, and how cookies + CORS behave in each.

---

## Environment Overview

| Environment | Frontend | Backend | Cookie SameSite | Cookie Secure | Org Context |
|-------------|----------|---------|----------------|--------------|-------------|
| Local ↔ Local | `localhost:3000` | `localhost:8008` | `Lax` | ❌ omitted (HTTP) | `X-ORG-ID` header |
| Local ↔ Staging | `localhost:3000` | `api.staging.mydomain.com` | `Lax` via proxy | ✅ | `X-ORG-ID` header |
| Staging ↔ Staging | `app.staging.mydomain.com` | `api.staging.mydomain.com` | `Lax` | ✅ | `X-ORG-ID` header or subdomain |
| Production | `slug.mydomain.com` | `*.mydomain.com` (same backend) | `Lax` | ✅ | Subdomain (+ `X-ORG-ID` accepted) |

`SameSite=Lax` (not `Strict`) is used in all environments so that cookies are sent when users follow links to the app from email, Slack, or other external pages. `Strict` would silently drop the session on those navigations.

---

## Local ↔ Local

Both frontend and backend running on your machine.

```
Frontend: http://localhost:3000
API:      http://localhost:8008
```

**`Secure` flag is intentionally absent** in local dev (`app.cookie-secure: false` in `application-local.yml`). Browsers silently drop cookies with the `Secure` flag on plain HTTP connections.

**CORS:** Backend allows `http://localhost:3000` with credentials. Frontend must set `withCredentials: true`.

**Env config:**
```env
VITE_API_BASE_URL=http://localhost:8008
```

**Org context:** Send `X-ORG-ID` header with the selected org's UUID. No subdomain to extract from.

**Swagger:** Available at `http://localhost:8008/swagger-ui/index.html`. Login via Swagger to set cookies in the browser, then all Swagger requests include them automatically.

---

## Local ↔ Staging

Frontend on your machine, connecting to the shared staging API.

```
Frontend: http://localhost:3000
API:      https://api.staging.mydomain.com
```

**Problem without proxy:** These are completely different origins. `SameSite=Lax` cookies set by the staging API are blocked by the browser on cross-site requests from `localhost`.

**Solution — Vite dev proxy:**

```ts
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'https://api.staging.mydomain.com',
        changeOrigin: true,
        secure: true,
      }
    }
  }
})
```

With the proxy, the browser sees all API requests going to `localhost:3000/api/...` — same origin, `SameSite=Lax` works, no CORS issues. The Vite dev server forwards them to staging behind the scenes.

**Env config:**
```env
VITE_API_BASE_URL=    # relative — goes through proxy
```

**Org context:** Send `X-ORG-ID` header.

**Swagger:** Access the staging Swagger directly at `https://api.staging.mydomain.com/swagger-ui.html` in your browser. Log in there to get cookies scoped to the staging domain. You cannot use local Swagger against the staging API.

---

## Staging ↔ Staging

Both frontend and API deployed to staging infrastructure.

```
Frontend: https://app.staging.mydomain.com  (or https://staging.mydomain.com)
API:      https://api.staging.mydomain.com
```

These are subdomains of the same parent domain (`mydomain.com`) — the browser treats them as same-site. `SameSite=Lax` works.

**Cookie domain:** Backend sets `Domain=.staging.mydomain.com` in staging.

**CORS:** Backend allows the staging frontend origin with credentials.

**Env config:**
```env
VITE_API_BASE_URL=https://api.staging.mydomain.com
```

**Org context:** Send `X-ORG-ID` header. Staging doesn't use org subdomains.

**Swagger:** Available at `https://api.staging.mydomain.com/swagger-ui.html`.

---

## Production

```
Frontend: https://acme.mydomain.com        (org subdomain)
API:      https://acme.mydomain.com  (same domain — or *.mydomain.com → same backend)
```

All org subdomains (`*.mydomain.com`) point to the same backend via wildcard DNS. The backend reads the slug from the `Host` header to determine org context.

**Cookie domain:** `Domain=.mydomain.com` — cookie is shared across all `*.mydomain.com` subdomains. A user logged into `acme.mydomain.com` has their session cookie automatically sent to `globex.mydomain.com`. Access is still gated by RBAC — having the cookie sent doesn't mean access is granted.

**Org context:** The subdomain IS the org context. Backend extracts slug from `Host` header. `X-ORG-ID` header is also accepted and takes precedence if sent.

**Swagger:** ⚠️ **Disabled in production.**
> ❓ **Open question (to confirm before writing the production profile):** Should there be a restricted internal Swagger behind VPN or HTTP basic auth for production debugging? Decide before building the production Spring profile.

**Env config:**
```env
VITE_API_BASE_URL=    # relative — same domain
```

---

## TPP in Production

A TPP managing multiple orgs:

```
Session at acme.mydomain.com:
  Cookie: Domain=.mydomain.com  ← sent to ALL *.mydomain.com

Opens globex.mydomain.com in new tab:
  Cookie sent automatically
  Backend: Host=globex.mydomain.com → slug=globex → validates TPP has role in globex → grants access
```

The frontend should:
1. After login, fetch the list of orgs the user has access to
2. Display them in a navigation/org-switcher
3. When user selects an org in production → navigate to `slug.mydomain.com`
4. When user selects an org in local/staging → update stored org slug + `X-ORG-ID` header

---

## Environment Config Summary

```ts
// src/config/env.ts

const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  isProduction: import.meta.env.PROD,
  currentOrgSlug: extractSlugFromHostname(), // null in local/staging
}

function extractSlugFromHostname(): string | null {
  const host = window.location.hostname  // e.g. "acme.mydomain.com"
  const parts = host.split('.')
  if (parts.length >= 3) return parts[0]  // "acme"
  return null  // localhost or app.staging.mydomain.com
}
```
